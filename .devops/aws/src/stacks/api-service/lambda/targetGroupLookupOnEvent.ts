// The AWS SDK is provided by the runtime. Other node modules must be uploaded via zipfile
import {
  GetResourcesCommand,
  ResourceGroupsTaggingAPIClient,
  type TagFilter,
} from '@aws-sdk/client-resource-groups-tagging-api';

// ES Modules import

/*
    Given the name of a service and the name of its corresponding canary
    service, which are assumed to be running behind the same ingress and on the
    same service port, this function looks for an ALB target group associated
    with the main service and a separate target group associated with this
    canary. It identifies these target groups by their tags, which we assume
    will be set in a specific way by the ALB controller. Then, it returns the
    name of each target group.
*/
export async function handler(event: {
  ResourceProperties: {
    region: string;
    clusterName: string;
    namespaceName: string;
    ingressName: string;
    serviceName: string;
    canaryServiceName: string;
    servicePort: string | number;
  };
}) {
  console.log('event', event);
  const {
    region,
    clusterName,
    namespaceName,
    ingressName,
    serviceName,
    canaryServiceName,
    servicePort,
  } = event.ResourceProperties;
  const resourceGroupTaggingClient = new ResourceGroupsTaggingAPIClient({
    region,
  });
  const getTargetGroupArn = withRetries(
    {
      maxRetries: 30,
      initialTimeMsBetweenRetries: 1000,
      maxTimeMsBetweenRetries: 5000,
    },
    async (serviceName: string) => {
      console.log('looking up target group for service:', serviceName);
      const tags: TagFilter[] = [
        {
          Key: 'ingress.k8s.aws/resource',
          Values: [
            `${namespaceName}/${ingressName}-${serviceName}:${servicePort}`,
          ],
        },
        {
          Key: 'elbv2.k8s.aws/cluster',
          Values: [clusterName],
        },
      ];

      const command = new GetResourcesCommand({
        TagFilters: tags,
      });

      const response = await resourceGroupTaggingClient.send(command);
      console.log('target groups:', response);

      if (
        response?.ResourceTagMappingList === undefined ||
        response?.ResourceTagMappingList.length === 0
      ) {
        throw new Error(
          `No target group was found with the tags: ${JSON.stringify(tags)}`,
        );
      }
      if (response?.ResourceTagMappingList?.length > 1) {
        throw new Error(
          `More than one target group is found with the tag: ${JSON.stringify(
            tags,
          )}`,
        );
      }
      return response?.ResourceTagMappingList?.at(0)?.ResourceARN;
    },
  );

  try {
    const targetGroupArn = await getTargetGroupArn(serviceName);

    const canaryTargetGroupArn = await getTargetGroupArn(canaryServiceName);

    const targetGroupName = (arn: string | undefined) => {
      if (arn === undefined) {
        throw new Error('ARN is undefined');
      }
      const index = arn.indexOf('targetgroup');
      if (index === -1) {
        throw new Error(`ARN: ${arn} does not contain 'targetgroup'`);
      }
      return arn.slice(index);
    };

    console.log('targetgroupArn', targetGroupArn);
    // resource attributes must be in the Data object
    // https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.custom_resources/README.html#handling-lifecycle-events-onevent
    return {
      Data: {
        TargetGroupName: targetGroupName(targetGroupArn),
        CanaryTargetGroupName: targetGroupName(canaryTargetGroupArn),
      },
    };
  } catch (error) {
    console.error('Error occurred during target group lookup:', error);
    throw error;
  }
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    return setTimeout(resolve, ms).unref();
  });
}

function withRetries<Args extends unknown[], Return>(
  retryPolicy: {
    maxRetries: number;
    initialTimeMsBetweenRetries: number;
    maxTimeMsBetweenRetries: number;
    jitter?: boolean;
    nextRetryWaitTimeMultiple?: number;
    isRetryableError?: (rejectionValue: unknown) => boolean;
  },
  fn: (this: void, ...args: Args) => Promise<Return>,
): (...args: Args) => Promise<Return> {
  const {
    maxRetries,
    initialTimeMsBetweenRetries,
    maxTimeMsBetweenRetries,
    jitter = true,
    nextRetryWaitTimeMultiple = 2,
    isRetryableError = () => true,
  } = retryPolicy;
  return async (...args) => {
    for (let i = 0; i <= maxRetries; ++i) {
      try {
        return await fn(...args);
      } catch (ex) {
        if (i === maxRetries || !isRetryableError(ex)) {
          throw ex;
        }
        const waitTimeMs = Math.min(
          maxTimeMsBetweenRetries,
          (jitter ? Math.random() : 1) *
            (initialTimeMsBetweenRetries * nextRetryWaitTimeMultiple ** i),
        );
        await sleep(waitTimeMs);
      }
    }
    throw new Error('Invalid retry attempts');
  };
}
