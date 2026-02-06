import * as Aws from '@cdktf/provider-aws';
import { S3Backend } from 'cdktf';
import type { Construct } from 'constructs';

import type { StackProps } from './types';

export function makeStateBucketName(stackProps: StackProps) {
  return `coop-${stackProps.environment}-${stackProps.region}-terraform-backend`;
}

export function toTitleCase(input: string): string {
  return input
    .toLowerCase() // Convert the entire string to lowercase first
    .split(' ') // Split the string into words
    .map((word) => word.charAt(0).toUpperCase() + word.substring(1)) // Capitalize the first letter of each word
    .join(' '); // Join the words back into a single string
}

export function makeS3Backend(
  scope: Construct,
  stackId: string,
  props: StackProps,
) {
  const stateBucket = makeStateBucketName(props);
  return new S3Backend(scope, {
    bucket: stateBucket,
    key: `${stackId}.tfstate`,
    region: props.region,
  });
}
export function makeAwsProvider(
  scope: Construct,
  region: string,
  environment: string,
) {
  return new Aws.provider.AwsProvider(scope, 'aws-provider', {
    region,
    defaultTags: [
      {
        tags: {
          environment,
        },
      },
    ],
  });
}
