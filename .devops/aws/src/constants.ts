import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';
import { KubectlV29Layer } from '@aws-cdk/lambda-layer-kubectl-v29';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { Construct } from 'constructs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Useful for getting reference to the main app's Dockerfile, or the source code
// directories outside of the devops folder.
export const repoRootDir = pathJoin(__dirname, '../../..');

export const awsSrcDir = __dirname;

export type PgEnvVar = (typeof pgEnvVars)[number];
export const pgEnvVars = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
] as const;

export type RedisEnvVar = (typeof redisEnvVars)[number];
export const redisEnvVars = [
  'REDIS_USE_CLUSTER',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USER',
  'REDIS_PASSWORD',
] as const;

export type ScyllaEnvVars = (typeof scyllaEnvVars)[number];
export const scyllaEnvVars = [
  'SCYLLA_USERNAME',
  'SCYLLA_PASSWORD',
  'SCYLLA_HOSTS',
  'SCYLLA_LOCAL_DATACENTER',
] as const;

export const makeKubectlVersionProps = (scope: Construct) => ({
  version: KubernetesVersion.V1_29,
  kubectlLayer: new KubectlV29Layer(scope, 'KubectlLayer'),
});
