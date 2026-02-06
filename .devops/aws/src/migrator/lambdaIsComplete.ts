// The AWS SDK is provided by the runtime. Other node modules must be bundled via esbuild.
import * as k8s from '@kubernetes/client-node';

/**
 * This lambda function is used to check if a Kubernetes job has completed. The
 * primary use case is for Cloudformation to wait for database migrations to complete
 * before continuing.
 * @param event
 * @returns
 */
export async function handler(event: {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties: {
    cert: string;
    token: string;
    clusterServer: string;
    jobBody: string;
  };
}) {
  if (event.RequestType === 'Delete') {
    return {
      IsComplete: true,
    };
  }
  const {
    cert: caData,
    token,
    clusterServer: server,
    jobBody: serializedJobBody,
  } = event.ResourceProperties;
  const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
  const kubeconfig = new k8s.KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      name: 'cluster',
      server,
      // caData is a base64 encoded string.
      caData,
    },
    {
      name: 'migrations',
      token: decodedToken,
    },
  );

  const jobBody = JSON.parse(serializedJobBody) as k8s.V1Job;

  const k8sApi = kubeconfig.makeApiClient(k8s.BatchV1Api);
  if (
    jobBody.metadata?.name === undefined ||
    jobBody.metadata?.namespace === undefined
  ) {
    throw new Error('Job creation failed: name and namespace are required');
  }
  const response = await k8sApi.readNamespacedJobStatus(
    jobBody.metadata.name,
    jobBody.metadata.namespace,
  );

  const condition = response.body.status?.conditions?.[0];

  if (condition?.type === 'Failed' && condition?.status === 'True') {
    throw new Error('Job failed');
  }

  if (condition?.type === 'Complete' && condition?.status === 'True') {
    console.log('Job is complete');
    return {
      IsComplete: true,
      Data: {
        hello: 'world',
      },
    };
  }

  return {
    IsComplete: false,
  };
}
