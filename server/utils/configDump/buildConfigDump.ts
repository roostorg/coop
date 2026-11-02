import { CONFIG_CATALOG } from './catalog.js';
import { redactConfigValue } from './redact.js';

type Env = Readonly<Record<string, string | undefined>>;

type ConfigEntry = {
  value: string | null;
  set: boolean;
  source: 'env' | 'default' | 'derived';
  redacted?: true;
};

/**
 * The shape is shared with Osprey's `osprey-cli config dump`, so bug reports
 * from either project read the same way. Bump `schema_version` on any
 * incompatible change.
 */
export type ConfigDump = {
  schema_version: 1;
  generated_at: string;
  app: { name: 'coop'; version: string | null; commit: string | null };
  runtime: { node: string; platform: string };
  plugins: string[];
  config: Record<string, Record<string, ConfigEntry>>;
};

function entry(
  key: string,
  value: string,
  set: boolean,
  source: ConfigEntry['source'],
): ConfigEntry {
  const result = redactConfigValue(key, value);
  return {
    value: result.value,
    set,
    source,
    ...(result.redacted ? { redacted: true as const } : {}),
  };
}

function reportedCommit(
  env: Env,
  checkoutCommit: string | null,
): string | null {
  // Images built without a BUILD_ID arg have it set to "", so empty counts as
  // unset.
  const commit = [env.BUILD_ID, env.GIT_COMMIT_SHA, checkoutCommit].find(
    (it) => it != null && it !== '',
  );
  if (commit == null) {
    return null;
  }
  return /^[0-9a-f]{7,40}$/i.test(commit)
    ? commit
    : redactConfigValue('BUILD_ID', commit).value;
}

/**
 * Builds the redacted effective-config report from the given environment.
 * Only keys in {@link CONFIG_CATALOG} are reported; other env vars are never
 * read, so unrelated secrets in the environment cannot leak into the output.
 */
export function buildConfigDump(opts: {
  env: Env;
  now: Date;
  /** The `version` in server/package.json, set to the release tag at release. */
  appVersion: string | null;
  /** HEAD when run from a git checkout; images set BUILD_ID instead. */
  checkoutCommit: string | null;
  nodeVersion: string;
  platform: string;
  integrationPackages: readonly string[];
}): ConfigDump {
  const { env } = opts;

  const config: ConfigDump['config'] = {};
  for (const [group, specs] of Object.entries(CONFIG_CATALOG)) {
    const groupEntries: Record<string, ConfigEntry> = {};
    for (const spec of specs) {
      const raw = env[spec.key];
      const derived = raw === undefined ? spec.derive?.(env) : undefined;
      groupEntries[spec.key] =
        raw !== undefined
          ? entry(spec.key, raw, true, 'env')
          : derived !== undefined
            ? entry(spec.key, derived, false, 'derived')
            : spec.default !== undefined
              ? entry(spec.key, spec.default, false, 'default')
              : { value: null, set: false, source: 'default' };
    }
    config[group] = groupEntries;
  }

  return {
    schema_version: 1,
    generated_at: opts.now.toISOString(),
    app: {
      name: 'coop',
      version: opts.appVersion,
      commit: reportedCommit(env, opts.checkoutCommit),
    },
    runtime: { node: opts.nodeVersion, platform: opts.platform },
    plugins: opts.integrationPackages
      .map((it) => redactConfigValue('package', it).value)
      .sort(),
    config,
  };
}
