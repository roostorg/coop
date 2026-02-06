// The AWS SDK is provided by the runtime. Other node modules must be uploaded via zipfile
import {
  DescribeLoadBalancersCommand,
  ElasticLoadBalancingV2Client,
} from '@aws-sdk/client-elastic-load-balancing-v2';

export async function handler(event: {
  ResourceProperties: { hostname: string; region: string };
}) {
  console.log('event', event);
  const { hostname, region } = event.ResourceProperties;
  const client = new ElasticLoadBalancingV2Client({ region });
  // we don't have any way to search for the target load balancer using this SDK method so we return all load balancers.
  const command = new DescribeLoadBalancersCommand({});

  try {
    const response = await client.send(command);
    console.log('load balancers', response);

    const loadBalancerArn = response?.LoadBalancers?.find(
      (lb) => lb.DNSName === hostname,
    )?.LoadBalancerArn;

    console.log('loadbalancerArn', loadBalancerArn);

    const loadbalancerArnDelimiter = 'app/';
    const index = loadBalancerArn?.indexOf(loadbalancerArnDelimiter);
    if (index === -1) {
      throw new Error(
        `${loadbalancerArnDelimiter} not found in ARN: ${loadBalancerArn}`,
      );
    }
    const loadBalancerName = loadBalancerArn?.slice(index);

    // resource attributes must be in the Data object
    // https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.custom_resources/README.html#handling-lifecycle-events-onevent
    return {
      Data: {
        LoadBalancerArn: loadBalancerArn,
        LoadBalancerName: loadBalancerName,
      },
    };
  } catch (error) {
    console.error('Error occurred during load balancer lookup:', error);
    throw error;
  }
}
