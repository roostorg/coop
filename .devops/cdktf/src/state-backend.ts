import * as Aws from '@cdktf/provider-aws';
import { TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

import { StateBackendStackProps } from './main';
import { makeAwsProvider, makeStateBucketName } from './utils';

export class StateBackendStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: StateBackendStackProps) {
    super(scope, id);
    const { region, environment } = props;

    makeAwsProvider(this, region, environment);

    new Aws.s3Bucket.S3Bucket(this, 'backend-bucket', {
      bucket: makeStateBucketName(props),
    });
  }
}
