import resourceParser from 'k8s-resource-parser';

import { NodeAffinity, Quantity } from './imports/k8s.js';
import { DeploymentEnvironmentName } from './stacks/app_pipeline.js';
import { DeployedNodeType } from './stacks/k8s_cluster.js';
import { NonEmptyArray } from './types.js';

/**
 * Different kubernetes resources/fields have different naming restrictions, but
 * this returns a string (with minimal transformations on the input) that should
 * generally be safe in most kubernetes contexts (deployment names, container
 * names, etc.).
 *
 * @param rawName The name to shorten/transform into a valid resource name.
 * @param maxLength An optional limit for the length of the final string, as
 *   some contexts have especially short limits.
 */
export function toKubernetesName(rawName: string, maxLength: number = 50) {
  // 1. Trim
  // 2. Convert camelCase to kebab-case
  // 3. Lowercase everything (leading capital letters, e.g.) to simplify future
  //    steps
  // 4. Remove any non-alphanumeric characters (e.g., fancy unicode stuff, but
  //    also punctuation)
  // 5. Remove leading/trailing hyphens, as k8s doesn't permit those
  // 6. Combine multiple consecutive hyphens into one. (These likely emerged
  //    from the prior step.)
  // 7. Make sure the result isn't too long. (The DNS spec, which k8s depends
  //    on, limits names to 63 chars, but k8s consumes some of those characters,
  //    so using more than 52 is definitely not safe in some Jobs, and idk if
  //    other resources have even lower limits.)
  return rawName
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLength);
}

/**
 * AWS has various restrictions on how resources can be named and what sort of
 * values can go in name- or identifier-like fields. This function attempts to
 * turn an arbitrary string, using minimal transformations, into a string that
 * should be safe in most AWS contexts.
 *
 * TODO: in future, maybe take the resource type as an arg and set the max
 * length automatically?
 *
 * NB: ALB target group names are capped at 32 characters, while Elasticache
 * cluster names are limited to 50 characters (and used to be limited to 20).
 *
 * @param rawName The name to shorten/transform into a valid resource name.
 * @param maxLength An optional limit for the length of the final string, as
 *   some resource types have especially short limits.
 */
export function toAwsName(rawName: string, maxLength: number = 50) {
  return toKubernetesName(rawName, maxLength);
}

export type NodeJsMemoryOptions = {
  youngGenerationSemiSpaceSize?: Quantity;
  nodeExternalMemoryPercent?: number;
  majorGcInterval?: number;
};

/**
 * This function that returns command line options to use when starting Node
 * within a container, on the assumption that node will be the only thing
 * running within the container. The returned options help Node make full use of
 * the container's available memory and can configure Node's garbage collection
 * and memory allocation settings.
 *
 * For some of the below to make sense, you should know that v8 uses two
 * different garbage collection algorithms. This is v8's attempt to exploit the
 * "generational hypothesis", which says that overwhelming majority of
 * newly-allocated objects will become garbage almost immediately, while the
 * remaining few objects will end up living on for a very long time.
 * Accordingly, v8 runs one algorithm on newly-allocated objects (the 'young
 * generation'), and this algorithm is optimized under the assumption that most
 * of these objects will be garbage. Objects that remain alive after this first
 * collection attempt (the 'old generation') get collected with a different
 * algorithm in the future, which is optimized under the assumption that the old
 * generation will tend to contain less garbage, but be bigger (as it eventually
 * comes to contain all of the app's long-lived objects) and more frgamented.
 *
 * The algorithm that collects the young generation is called a 'minor GC' (aka
 * a 'scavenge', which is the name of the main operation involved), because it
 * scans only the young generation objects (as opposed to the full heap) and has
 * a much simpler memory compaction process. The algorithm that collects the old
 * generation is called a 'major GC', or a mark-sweep-compact GC. While a major
 * GC does involve more total work, as the name implies, the lower frequency of
 * major GCs and the way the work is distributed to background threads means
 * that the minor GCs can cause performance issues at least as often.
 *
 * @param opts.containerMemoryRequest The amount of memory available to the
 *   container (before Kubernetes may kill it or start using swap). This is
 *   required because, without it, Node does a pretty crappy job utilizing all
 *   of the available memory; see https://github.com/nodejs/node/issues/35573.
 *   When trying to choose a memory limit to use for a Node app, consider that
 *   the amount of memory the app needs will depend somewhat on its GC settings.
 *
 * @param opts.nodeExternalMemoryPercent This is the percentage of the
 *   container's memory to set aside for allocations that Node does that don't
 *   happen on the v8 heap. (Node calls this memory "external memory".) The
 *   biggest culprit of such allocations are Buffer objects, but I think some
 *   types of memory allocated by Node native modules might count too. It should
 *   be safe to leave the default here unless your app is allocating many/big
 *   Buffers or you run into issues.
 *
 * @param opts.youngGenerationSemiSpaceSize Roughly, the number of MB worth of
 *   new objects that can be allocated before v8 performs a minor GC. This is
 *   perhaps the most important garbage collection setting to tune when trying
 *   to get high throughput from a Node server. Reasonable values range from
 *   16MB to 256MB, and you should probably just try different values, doubling
 *   each time. The default value is 16 MB. As the value is raised, a few things
 *   will happen:
 *
 *     1. There will be a proportional decrease in the number of minor GCs.
 *        I.e., if you double `youngGenerationSemiSpaceSize`, the number of
 *        minor GCs will be cut roughly in half. (The `scavenge-task-trigger`
 *        flag means that it's not _quite_ right to say that v8 will perform a
 *        minor GC every time `youngGenerationSemiSpaceSize`-worth of objects
 *        is allocated, but that's a good mental model.)
 *
 *     2. Node's memory usage will go up by 3 MB for every 1 MB that this
 *        value is increased by. This is a fundamental consequence of the
 *        "semi-space" design that v8 uses for minor GCs (which produces a 2MB
 *        increase for a 1MB bump in the setting's value), plus the way it
 *        sizes the "large object space".
 *
 *      3. Each 'minor GC' will pause the main thread for longer. HOWEVER, the
 *         time increase may not be proportional to the percentage by which the
 *         `youngGenerationSize` setting was increased.
 *
 *         This is where there's an opportunity for major throughput wins.
 *         E.g., you may be able to double this setting's value, which cuts the
 *         number of minor GCs in half, while each such GC might only take ~10%
 *         longer, meaning that total GC time is way down. I believe this
 *         effect is due to finding a value at which the scavenger worker
 *         threads are able to utilize the CPU most efficiently (which depends
 *         in turn on the server's available CPU cores etc). At some point,
 *         increasing this value stops having a positive effect, and total GC
 *         time starts going back up.
 *
 *         Note that, as this value is increased, you're gaining throughput at
 *         the cost of increased tail latency (though hopefully that increase
 *         is negligible), as some requests will be blocked for longer during
 *         the longer GC pauses.
 *
 *   NB: while a 'minor GC' does involve less work than a 'major GC', it's often
 *   the 'minor GCs' that cause performance problems, at least in server use
 *   cases. (v8's garbage collector is, unfortunately, highly tuned for Chrome
 *   usage patterns.) The reason is that:
 *
 *   1. By default, 'major GCs' only run when the size taken up by long-lived
 *      objects (i.e., 'old generation' objects) approaches the configured
 *      limit. However, after its initial startup, a server is likely to
 *      allocate few, if any, long-lived objects on each request. (In fact,
 *      doing so may indicate a memory leak.) There are certainly exceptions --
 *      db connections, data in in-memory caches, etc. -- but they truly are
 *      exceptions. Accordingly, major GCs just don't need to run very
 *      frequently, relative to minor GCs.
 *
 *   2. The minor GC's scavenge algorithm requires pausing the main thread while
 *      the reachability of young generation objects is tested (and while
 *      still-reachable ones, which should be few, are copied around). Although
 *      this work is divided among a number of parallel worker threads, and
 *      there's generally not as much work to do (b/c the young generation size
 *      is small, relative to the total heap's size), the main thread still must
 *      be paused during this time. By contrast, the reachability analysis of
 *      old generation objects in a major GC is done [largely in the
 *      background](https://v8.dev/blog/trash-talk) (with only a little
 *      synchronization overhead on the main thread), although the compaction
 *      step can involve longer main thread pauses. In server use cases, where a
 *      bunch of objects are allocated per request, minor GCs can become very
 *      common and the pauses can really add up!
 *
 * @param opts.majorGcInterval This will force v8 to run a major GC after the
 *   specified number of allocations. By default v8 only runs major GCs as it's
 *   approaching the heap's memory limit, so setting this will force v8 to run
 *   major GCs more frequently. Major GCs also block the main JS thread, though
 *   primarily when old space objects are being copied around (compaction),
 *   which shouldn't happen much if a GC runs and there isn't much garbage.
 *
 *   Forcing more frequent major GCs will lower peak memory use and will
 *   probably result in each GC pausing the main thread for less time (e.g., as
 *   there'll be less compaction work), which lowers the effect of GC on tail
 *   latencies, but will increase the total amount of time spent on GC and lower
 *   throughput.
 *
 *   We've had cases where, unless we enabled this setting, we'd get an OOM
 *   error. This seemed very strange to me, as v8 is supposed to always do a
 *   major GC before failing with OOM, and I'd expect that final GC to be able
 *   reclaim all the same memory that would've been reclaimed earlier by doing
 *   more frequent GCs; if that's right, then more-frequent GCs shouldn't
 *   prevent OOM. However, it's possible that there's a v8 bug around this final
 *   GC not happening or not being complete (which has happened in v8 before),
 *   or there's actually some part of this major GC that requires allocating new
 *   memory that I don't know about. More interestingly, though, it may have
 *   been a weird interaction between Node and kubernetes. I.e., it may have
 *   been that, when the GC pauses were infrequent, Node's CPU usage was lower
 *   (excluding the ocassional gc-driven spike, which may have been brief enough
 *   to not trigger an autoscale?), so kubernetes launched fewer replicas.
 *   Accordingly, each replica was given more concurrent requests to handle.
 *   Then, when the final GC kicked in, it may have actually been the case that
 *   there weren't enough dead objects to collect (thanks to Node having a
 *   greater number of requests in progress, and each pending request having
 *   some live objects), leading to a bonafide OOM. I don't know.
 */
export function computeNodeMemoryOptions(
  opts: { containerMemoryRequest: Quantity } & NodeJsMemoryOptions,
) {
  const {
    containerMemoryRequest,
    youngGenerationSemiSpaceSize,
    nodeExternalMemoryPercent = 0.1,
    majorGcInterval,
  } = opts;

  if (nodeExternalMemoryPercent >= 1) {
    throw new Error(
      '`nodeExternalMemoryPercent` should be given as a decimal.',
    );
  }

  const containerMemoryRequestMb =
    resourceParser.memoryParser(String(containerMemoryRequest.value)) /
    1024 ** 2;

  const youngGenerationSemiSizeMb = youngGenerationSemiSpaceSize
    ? resourceParser.memoryParser(
        youngGenerationSemiSpaceSize.value.toString(),
      ) /
      1024 ** 2
    : 16; // 16 is v8's default

  // Besides the size for the young and old generation objects (and the empty
  // semi-space for collecting the young generation), v8 has to store things
  // like compiled code, "large objects", various data gathered at runtime for
  // faster perf or JIT compilation (e.g., object maps, inline caches), etc.
  // While we could inspect the v8 internals to try to figure out the sizes
  // reserved for all these things, it's more future proof to just pick some
  // conservative numbers. Beyond that, Node stores some stuff outside the v8
  // heap, which it calls external memory; the biggest culprit here are Buffers.
  // Finally, we wanna leave some memory for the OS, etc.
  const nonOldSpaceMemoryMb =
    // Add 2x the young gen semi-space size to account for the other semi-space.
    youngGenerationSemiSizeMb * 2 +
    // Add in memory for large object space, which v8 defaults to match the
    // young gen semi-space size. NB: according to the heap metrics in DD, there
    // appear to actually be two large object spaces (one for the old generation
    // and one for the new gen), but it looks like the old gen version counts
    // against max-old-space-size, according to https://stackoverflow.com/a/76744903
    youngGenerationSemiSizeMb +
    // Leave some memory for the OS and its code caches, and for other v8 data
    // (including the JS heap's code space, the JS stack, and, mostly, the C++
    // heap that manages v8's memory for its parsers, compilers, inline caches,
    // etc.) This seems, in practice, to need a minimum size of 256 MB to
    // totally avoid OOMs because the memory usage here is spiky (esp, I think,
    // for the C++ heap).
    //
    // TODO: It'd be much more efficient if we could make this value lower, and
    // handle spikes with swap. v8 really is designed with swap in mind (see
    // https://github.com/v8/v8/blob/8012409228a1284f86a0b01bbef9456606c8cdfd/src/heap/heap.h#L291),
    // and swap generally improves performance a lot in managed languages (see
    // https://chrisdown.name/2018/01/02/in-defence-of-swap.html), which is why
    // kubernetes added alpha support for swap a few years back
    // (https://kubernetes.io/blog/2021/08/09/run-nodes-with-swap-alpha/).
    // However, EKS doesn't support swap yet:
    // https://github.com/aws/containers-roadmap/issues/1714
    256 +
    containerMemoryRequestMb * nodeExternalMemoryPercent;

  const maxOldSpaceSizeMb = containerMemoryRequestMb - nonOldSpaceMemoryMb;

  if (
    maxOldSpaceSizeMb < nonOldSpaceMemoryMb ||
    maxOldSpaceSizeMb < youngGenerationSemiSizeMb * 3
  ) {
    throw new Error(
      'Invalid memory configuration: this configuration would reserve less ' +
        "than half of the container's memory for old-space objects, or would " +
        'reserve less memory for old-space objects than new-space ones, ' +
        'which is usually a bad idea. This could be happening because the ' +
        'container has a low overall memory request relative to the fixed ' +
        'amount of memory this function reserves for non-JS-heap data created ' +
        'by v8, or it could be because the `youngGenerationSemiSpaceSize` ' +
        "setting is too large. If you're sure `opts.youngGenerationSemiSpaceSize` " +
        "is set correctly, please increase your pod's memory request. You tried " +
        `to reserve ${nonOldSpaceMemoryMb}Mi for non-old-space memory, with ` +
        `${youngGenerationSemiSizeMb}Mi set aside for each young generation ` +
        `semispace, but only ${maxOldSpaceSizeMb}Mi for old-space memory.`,
    );
  }

  return [
    // Make GC more aggressive overall, which we've found very useful in our
    // server contexts and which is recommended by Heroku; see
    // https://blog.heroku.com/node-habits-2016#7-avoid-garbage
    // NB: may not do anything anymore in 2023; see
    // https://github.com/v8/v8/blob/c051ee8d837aaf5a2863b5eb2c06cb0fb6c52d6c/src/flags/flag-definitions.h#L1579
    // and https://github.com/nodejs/node/blob/89c66ae1ebee70116875017171d2fd7a39bab865/deps/v8/BUILD.gn#L1060C1-L1060C1
    ...(majorGcInterval ? [`--gc_interval=${majorGcInterval}`] : []),
    ...(youngGenerationSemiSizeMb > 0
      ? [`--max-semi-space-size=${Math.floor(youngGenerationSemiSizeMb)}`]
      : []),
    // If the nodeMaxOldSpaceSize <= 0, we'll use the v8 default memory
    // management settings, which should give node/v8 about half of the pod's
    // memory. I think that's reasonable?
    ...(maxOldSpaceSizeMb > 0
      ? [`--max-old-space-size=${Math.round(maxOldSpaceSizeMb)}`]
      : []),
  ];
}
/*
 * This function returns the annotations that should be added to a pod to enable
 * OpenTelemetry tracing and Datadog profiling for that pod.
 *
 * @param containerName The name of the container that should be instrumented.
 */
export function getInstrumentationPodAnnotations(containerName: string) {
  return {
    'instrumentation.opentelemetry.io/inject-nodejs': 'opentelemetry/default',
    'instrumentation.opentelemetry.io/container-names': containerName,
  };
}

export function getTracingEnvVars(
  serviceName: string,
  env: DeploymentEnvironmentName,
) {
  // We lowercase the env because datadog seems to have a bug where it
  // internally lowercases the env when it's provided in DD_ENV but _not_ when
  // it reads it from `deployment.environment` in trace spans. The result is
  // that we get some weird mismatches/duplication in the DD UI, which this
  // should fix.
  const normalizedEnv = env.toLowerCase();

  return [
    { name: 'DD_SERVICE', value: serviceName },
    { name: 'OTEL_SERVICE_NAME', value: serviceName },

    { name: 'DD_ENV', value: normalizedEnv },
    // TODO: remove this after checking it is included by default.
    {
      name: 'DD_ENTITY_ID',
      // I believe this must be uid for Origin Detection to work
      // https://docs.datadoghq.com/developers/dogstatsd/?tab=kubernetes#origin-detection-over-udp
      valueFrom: { fieldRef: { fieldPath: 'metadata.uid' } },
    },
    // this is only read by the nodejs sdk.
    {
      name: 'DD_TRACING_ENABLED',
      value: 'false',
    },
    {
      name: 'POD_NAME',
      valueFrom: { fieldRef: { fieldPath: 'metadata.name' } },
    },
    {
      name: 'DD_TAGS',
      // entity id must be manually set here for some reason
      // https://github.com/DataDog/dd-trace-js/issues/2753#issuecomment-1523390329

      // pod name is not added by default when using origin detection over UDP
      value: 'dd.internal.entity_id:$(DD_ENTITY_ID),pod_name:$(POD_NAME)',
    },
    {
      name: 'OTEL_RESOURCE_ATTRIBUTES',
      value: `deployment.environment=${normalizedEnv},service.instance.id=$(POD_NAME)`,
    },

    // Datadog has a feature called "remote configuration" that allows some
    // settings on the agent -- like the trace sampling rate! -- to be set
    // through the Datadog UI; then the agent will automatically pick up the
    // new value without having to be restarted. The pods being traced then
    // periodically poll the agent to see if there's a new value. However, this
    // remote configuration feature is in private beta, and we don't have access
    // to it yet, so the endpoint on the agent that the pods poll is disabled.
    // Accordingly, in our traces, we were seeing a bunch of requests to this
    // disabled `/v0.7/config` endpoint, which were cluttering up the traces w/
    // 404 spans. So, we tell our pods being traced that we don't have remote
    // configuration enabled, so they won't try to poll the agent for updated
    // sampling settings.
    {
      name: 'DD_REMOTE_CONFIGURATION_ENABLED',
      value: 'false',
    },
    // git repository url and commit sha are used by datadog to profiles to
    // source code.
    {
      name: 'DD_GIT_REPOSITORY_URL',
      value: 'github.com/roostorg/coop',
    },
    {
      name: 'DD_GIT_COMMIT_SHA',
      value: process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ?? 'undefined',
    },
    // TODO: remove this after checking it is included by default.
    {
      name: 'DD_AGENT_HOST',
      valueFrom: {
        fieldRef: {
          fieldPath: 'status.hostIP',
        },
      },
    },
    {
      name: 'HOST_IP',
      valueFrom: {
        fieldRef: {
          fieldPath: 'status.hostIP',
        },
      },
    },
    {
      name: 'OTEL_EXPORTER_OTLP_ENDPOINT',
      value: 'http://default-collector.opentelemetry:4317',
    },
  ];
}

export function getNodeAffinityForInstanceTypes(
  instanceTypes: Readonly<NonEmptyArray<DeployedNodeType>>,
): NodeAffinity {
  return {
    requiredDuringSchedulingIgnoredDuringExecution: {
      nodeSelectorTerms: [
        {
          matchExpressions: [
            {
              key: 'node.kubernetes.io/instance-type',
              operator: 'In',
              values: instanceTypes.slice(),
            },
          ],
        },
      ],
    },
  };
}

export function __throw(error: Error): never {
  throw error;
}
