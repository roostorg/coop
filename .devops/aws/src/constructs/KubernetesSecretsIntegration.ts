import { ICluster, ServiceAccount } from 'aws-cdk-lib/aws-eks';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Chart, ApiObject as KubeApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import jsonToYaml from 'json-to-pretty-yaml';
import _ from 'lodash';

import type { RolloutSpecTemplateSpec } from '../imports/argoproj.io.js';
import { PodSpec } from '../imports/k8s.js';
import { toKubernetesName } from '../utils.js';

const { uniq } = _;

export type SecretsMap<T extends string = string> = {
  readonly [K in T]: readonly [arn: string, jmesPath?: string];
};

// Users must provide the secrets to expose. They must also provide a service
// account with permission to read those secrets (in the same namespace as the
// eventual pods that'll use these secrets) _or_ the construct will auto-generate
// one, in which case it needs a cluster + namespace to know where to attach it.
export type KubernetesSecretsIntegrationProps = {
  secrets: SecretsMap;
} & (
  | {
      serviceAccount: ServiceAccount;
      cluster?: undefined;
      namespace?: undefined;
    }
  | { serviceAccount?: undefined; cluster: ICluster; namespace: string }
);

/**
 * Integrating Secrets Manager secrets with Kubernetes has a lot of moving
 * parts. This construct aims to hide all of them, and expose a few simple
 * methods to wire everything together.
 *
 * Behind the scenes, what needs to happen is:
 *
 * 1. There needs to be a service account with permission to read the secrets.
 *    (This needs to be hooked into the cluster with the standard OIDC-powered
 *    IAM integration in order for IAM to grant it permission to read the secrets.)
 *
 * 2. That service account must be attached to the pod that needs the secrets.
 *
 * 3. A SecretProviderClass object needs to be created, which will read the
 *    secrets from Secrets Manager and put them into a kubernetes secret, using
 *    a mapping (from secretArn and key path, when the secret holds an object,
 *    to the desired env var name). Iirc, the secrets need to end up in a native
 *    k8s secret b/c that's the simplest way to inject them into the pod as env
 *    vars, rather than the pod having to read them from a mounted volume.
 *
 * 4. Even though the SecretProviderClass is generating a k8s native secret,
 *    that secret has a lifecycle (e.g., its contents are only generated, and
 *    then periodically updated to account for changes in Secrets Manager, while
 *    there's actually a pods trying to use it). The SecretProviderClass manages
 *    this lifecycle, but doing that requires that a volume powered by the
 *    SecretProviderClass be defined and mounted into the pods, even though
 *    we're actually using the native secret to populate the pod's env vars.
 *
 * 5. Finally, in addition to the volume/volumeMount above, the pod's definition
 *    must actually include setting the env vars from the k8s secret, in the
 *    normal way.
 */
export class KubernetesSecretsIntegration extends Construct {
  private secrets: KubernetesSecretsIntegrationProps['secrets'];
  public serviceAccount: ServiceAccount;

  private secretProviderClassName: string;
  private generatedSecretName: string;
  private volumeName: string;

  constructor(
    scope: Construct,
    name: string,
    props: KubernetesSecretsIntegrationProps,
  ) {
    super(scope, name);
    const { serviceAccount, namespace, cluster, secrets } = props;

    const baseName = name.toLowerCase().endsWith('secrets')
      ? name.slice(0, -7)
      : name;

    this.volumeName = toKubernetesName(`${baseName}-secrets-volume`);
    this.generatedSecretName = toKubernetesName(`${baseName}-secret`);
    this.secretProviderClassName = toKubernetesName(
      `${baseName}-secrets-provider`,
    );

    this.secrets = secrets;
    this.serviceAccount =
      serviceAccount ??
      cluster.addServiceAccount(`${baseName}ServiceAccount`, {
        namespace: namespace,
        name: toKubernetesName(`${baseName}-service-account`),
      });

    this.serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: uniq(Object.values(props.secrets).map((it) => it[0])),
      }),
    );
  }

  /**
   * Takes a pod spec and returns a new one that passes the secrets to all
   * containers in the pod.
   */
  public getPodSpec<T extends PodSpec | RolloutSpecTemplateSpec>(
    podSpec: T,
  ): T {
    const existingServiceAccountName =
      podSpec.serviceAccount ?? podSpec.serviceAccountName;

    if (
      existingServiceAccountName &&
      existingServiceAccountName !== this.serviceAccount.serviceAccountName
    ) {
      throw new Error(
        `Cannot add secrets to a pod that's already using a different service account.`,
      );
    }

    // TODO: more validation re, e.g.,
    // volume mount names and paths, duplicate env var names.
    return {
      ...podSpec,
      serviceAccountName: this.serviceAccount.serviceAccountName,
      volumes: [
        ...(podSpec.volumes ?? []),
        {
          name: this.volumeName,
          csi: {
            driver: 'secrets-store.csi.k8s.io',
            readOnly: true,
            volumeAttributes: {
              secretProviderClass: this.secretProviderClassName,
            },
          },
        },
      ],
      containers: podSpec.containers.map((container) => ({
        ...container,
        volumeMounts: [
          ...(container.volumeMounts ?? []),
          {
            name: this.volumeName,
            mountPath: '/mnt/secrets-store',
            readOnly: true,
          },
        ],
        env: [
          ...(container.env ?? []),
          ...Object.keys(this.secrets).map((name) => ({
            name,
            valueFrom: {
              secretKeyRef: { name: this.generatedSecretName, key: name },
            },
          })),
        ],
      })),
    };
  }
  /**
   * Takes values for the coop app helm chart and injects secrets into it.
   * @param values this is the values object that will be passed to the chart
   * @returns the values object with the secrets and necessary config injected
   * into it.
   */
  public injectSecretsIntoCoopAppChart(values: any) {
    const secretsByArn = {} as {
      [arn: string]: { envVar: string; path?: string }[];
    };
    for (const [envVar, [secretArn, path]] of Object.entries(this.secrets)) {
      secretsByArn[secretArn] = secretsByArn[secretArn] ?? [];
      secretsByArn[secretArn].push({ envVar: envVar, path });
    }
    return {
      ...values,
      secretProviderClassName: this.secretProviderClassName,
      secrets: Object.entries(secretsByArn).map(([secretArn, entries]) => ({
        objectName: secretArn,
        ...(entries[0].path
          ? {
              jmesPath: entries.map(({ envVar: objectAlias, path }) => ({
                path,
                objectAlias,
              })),
            }
          : { objectAlias: entries[0].envVar }),
      })),
      serviceAccount: {
        create: false,
        name: this.serviceAccount.serviceAccountName,
      },
      env: [
        ...(values.env || []),
        ...Object.keys(this.secrets).map((name) => ({
          name,
          valueFrom: {
            secretKeyRef: { name: this.generatedSecretName, key: name },
          },
        })),
      ],
      volumes: [
        ...(values.volumes || []),
        {
          name: this.volumeName,
          csi: {
            driver: 'secrets-store.csi.k8s.io',
            readOnly: true,
            volumeAttributes: {
              secretProviderClass: this.secretProviderClassName,
            },
          },
        },
      ],
      volumeMounts: [
        ...(values.volumeMounts || []),
        {
          name: this.volumeName,
          mountPath: '/mnt/secrets-store',
          readOnly: true,
        },
      ],
    };
  }

  /**
   * Add the kubernetes resources that provide the secrets into an existing
   * chart, and set up any resources in that chart that need the secrets (like
   * pods/deployments) to be dependent on the secrets-providing resources.
   */
  public addToChart(scope: Chart, dependents: KubeApiObject[]) {
    if (this.serviceAccount.serviceAccountNamespace !== scope.namespace) {
      throw new Error(
        'The service account and the chart that defines all the secret-related ' +
          'k8s resources (including the pods using the secrets) must be in the ' +
          'same namespace.',
      );
    }

    const secretEnvVarNames = Object.keys(this.secrets);

    // The secrets are passed in as an ojbect where the keys are the desired
    // env vars, and the values explain how to set each env var from a secret.
    // However, the secret provider class instead requires that we pass it the
    // secrets grouped by secret arn, so we have to do some convoluted
    // reorganizing here.
    const secretsByArn = {} as {
      [arn: string]: { envVar: string; path?: string }[];
    };
    for (const [envVar, [secretArn, path]] of Object.entries(this.secrets)) {
      secretsByArn[secretArn] = secretsByArn[secretArn] ?? [];
      secretsByArn[secretArn].push({ envVar: envVar, path });
    }

    // Create the secrets provider within the given chart.
    // No need to specify namespace explicitly, as it's inherited from the chart.
    const secretsProvider = new KubeApiObject(
      scope,
      this.secretProviderClassName,
      {
        apiVersion: 'secrets-store.csi.x-k8s.io/v1alpha1',
        kind: 'SecretProviderClass',
        metadata: { name: this.secretProviderClassName },
        spec: {
          provider: 'aws',
          secretObjects: [
            // With this setup, we're generating one kubernetes secret (called
            // api-secrets) that holds an object as its value. That object is
            // populated based on the { objectName, key } records listed under
            // the `data` key below. In those { objectName, key } objects,
            // `objectName` refers to the name that we gave to some secret data
            // when we fetched it from AWS Secret Manager, while `key` refers to
            // the name of the key that we want to store the value under in the
            // generated k8s secret. So, what we're doing is fetching each
            // secret value out of AWS with a name that corresponds to the name
            // of the env var we ultimately want to populate from it. Then,
            // we're putting the secret values into our k8s secret object with
            // those same env var names as the keys. Finally, in the deployment,
            // we'll read in those same keys to the env.
            {
              data: secretEnvVarNames.map((k) => ({ objectName: k, key: k })),
              secretName: this.generatedSecretName,
              type: 'Opaque',
            },
          ],
          parameters: {
            // We assume that, if one env var generated by this ARN uses a jmes
            // path, then they all will, and vice versa, because our secrets are
            // either plain text or an object. Similarly, we assume that, if
            // there isn't a path, then there can only be one generated secret,
            // which seems be a requirement imposed by the SecretProviderClass,
            // but isn't too onerous (because, in this case, there'll only be
            // one value in the secret).
            objects: jsonToYaml.stringify(
              Object.entries(secretsByArn).map(([secretArn, entries]) => ({
                objectName: secretArn,
                ...(entries[0].path
                  ? {
                      jmesPath: entries.map(
                        ({ envVar: objectAlias, path }) => ({
                          path,
                          objectAlias,
                        }),
                      ),
                    }
                  : { objectAlias: entries[0].envVar }),
              })),
            ),
          },
        },
      },
    );

    dependents.forEach((dependent) => {
      dependent.addDependency(secretsProvider);
    });
  }
}
