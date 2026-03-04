import * as cdk from 'aws-cdk-lib';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import type { Construct } from 'constructs';

export class MigrationStack extends cdk.Stack {
  public readonly image: DockerImageAsset;
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    this.image = new DockerImageAsset(this, 'MigrationsImage', {
      directory: '../migrator',
      platform: Platform.LINUX_AMD64,
      ignoreMode: cdk.IgnoreMode.DOCKER,
    });
  }
}
