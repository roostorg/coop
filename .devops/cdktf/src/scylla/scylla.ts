import { S3Backend, TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';

import { Cluster } from '../../.gen/providers/scylladbcloud/cluster/index';
import { ScylladbcloudProvider } from '../../.gen/providers/scylladbcloud/provider/index';
import { DeploymentPipeline } from '../deployment-pipeline';
import { type EnvironmentProps } from '../main';
import { makeAwsProvider, makeStateBucketName } from '../utils';

import path = require('path');

export class ScyllaStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: EnvironmentProps) {
    super(scope, id);
    const stateBucket = makeStateBucketName(props);
    new S3Backend(this, {
      bucket: stateBucket,
      key: `${id}.tfstate`,
      region: props.region,
    });

    if (!process.env.SCYLLA_CLOUD_TOKEN) {
      throw new Error('SCYLLA_CLOUD_TOKEN environment variable must be set.');
    }

    new ScylladbcloudProvider(this, 'scylladbcloud', {
      token: process.env.SCYLLA_CLOUD_TOKEN,
    });

    makeAwsProvider(this, props.region, props.environment);

    new Cluster(this, 'cluster', {
      // this has to be an empty string since leaving it undefined defaults to
      // the wrong value
      alternatorWriteIsolation: '',
      cidrBlock: '172.31.0.0/16',
      cloud: 'AWS',
      enableDns: true,
      enableVpcPeering: true,
      name: props.scylla.clusterName,
      nodeCount: props.scylla.nodeCount,
      nodeDiskSize: props.scylla.nodeDiskSize,
      nodeType: props.scylla.nodeType,
      region: props.region,
      scyllaVersion: props.scylla.scyllaVersion,
      userApiInterface: 'CQL',
      lifecycle: props.lifecycle,
    });

    new DeploymentPipeline(this, 'deployment-pipeline', {
      pipelineName: id,
      stateBucket,
      targetStackId: id,
      sourceBranch: props.sourceBranch,
      sourceDirectory: path.basename(__dirname),
      environmentVariables: [
        {
          name: 'SCYLLA_CLOUD_TOKEN',
          type: 'SECRETS_MANAGER',
          value: 'CI/scylla:token',
        },
      ],
    });
  }
}
