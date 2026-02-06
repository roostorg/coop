// The AWS SDK is provided by the runtime. Other node modules must be bundled via esbuild.
import * as k8s from '@kubernetes/client-node';

/**
 * This lambda function is used to create a Kubernetes job. The primary use case
 * is for Cloudformation to run database migrations.
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
      Data: {
        msg: 'Nothing to do on delete.',
      },
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
      caData,
    },
    {
      name: 'migrations',
      token: decodedToken,
    },
  );

  const jobBody = JSON.parse(serializedJobBody) as k8s.V1Job;

  const k8sApi = kubeconfig.makeApiClient(k8s.BatchV1Api);
  if (jobBody.metadata?.namespace === undefined) {
    throw new Error("Job creation failed: 'namespace' is required");
  }

  await k8sApi.createNamespacedJob(jobBody.metadata.namespace, jobBody);

  return {
    Data: {
      msg: 'hello world onEvent handler',
    },
  };
}
