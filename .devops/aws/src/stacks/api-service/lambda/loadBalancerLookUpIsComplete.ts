// The AWS SDK is provided by the runtime. Other node modules must be uploaded via zipfile
import {
  DescribeLoadBalancersCommand,
  ElasticLoadBalancingV2Client,
  LoadBalancerStateEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2';

export async function handler(event: {
  Data: { LoadBalancerArn: string | undefined };
  ResourceProperties: { hostname: string; region: string };
}): Promise<{ IsComplete: boolean }> {
  console.log('event', event);
  if (!event.Data.LoadBalancerArn) {
    return { IsComplete: true };
  }
  console.log('event', event);
  const { hostname, region } = event.ResourceProperties;
  console.log('hostname', hostname);
  const client = new ElasticLoadBalancingV2Client({ region });
  const command = new DescribeLoadBalancersCommand({
    LoadBalancerArns: [event.Data.LoadBalancerArn],
  });

  try {
    const response = await client.send(command);
    console.log(
      'response',
      response,
      'code',
      response.LoadBalancers?.at(0)?.State?.Code,
    );

    return {
      IsComplete:
        response.LoadBalancers?.at(0)?.State?.Code ===
        LoadBalancerStateEnum.ACTIVE,
    };
  } catch (error) {
    console.error('Error occurred during load balancer lookup:', error);
    throw error;
  }
}
