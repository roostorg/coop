import {
  CodebuildProject,
  type CodebuildProjectEnvironmentEnvironmentVariable,
} from '@cdktf/provider-aws/lib/codebuild-project';
import { Codepipeline } from '@cdktf/provider-aws/lib/codepipeline';
import { DataAwsCodestarconnectionsConnection } from '@cdktf/provider-aws/lib/data-aws-codestarconnections-connection';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DataAwsKmsAlias } from '@cdktf/provider-aws/lib/data-aws-kms-alias';
import { DataAwsS3Bucket } from '@cdktf/provider-aws/lib/data-aws-s3-bucket';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { AssetType, Fn, TerraformAsset } from 'cdktf';
import { Construct } from 'constructs';

type DeploymentPipelineProps = {
  pipelineName: string;
  environmentVariables: CodebuildProjectEnvironmentEnvironmentVariable[];
  stateBucket: string;
  targetStackId: string;
  sourceDirectory: string;
  sourceBranch: string;
};

export class DeploymentPipeline extends Construct {
  constructor(scope: Construct, id: string, props: DeploymentPipelineProps) {
    super(scope, id);

    const bucket = new S3Bucket(this, 'bucket', {});

    const codeStarConnection = new DataAwsCodestarconnectionsConnection(
      this,
      'codestar-connection',
      {
        // TODO don't hardcode the connection ARN
        arn: 'arn:aws:codestar-connections:us-east-2:361188080279:connection/dae8a93b-a690-4eeb-8464-74932b3ca612',
      },
    );

    const codepipelinePermissionPolicyDocument = new DataAwsIamPolicyDocument(
      this,
      'policy-document',
      {
        statement: [
          {
            effect: 'Allow',
            actions: [
              's3:GetObject',
              's3:GetObjectVersion',
              's3:GetBucketVersioning',
              's3:PutObjectAcl',
              's3:PutObject',
            ],
            resources: [bucket.arn, `${bucket.arn}/*`],
          },
          {
            actions: ['codestar-connections:UseConnection'],
            effect: 'Allow',
            resources: [codeStarConnection.arn],
          },
          {
            actions: ['codebuild:BatchGetBuilds', 'codebuild:StartBuild'],
            effect: 'Allow',
            resources: ['*'],
          },
        ],
      },
    );

    const codepipelineAssumeRolePolicy = new DataAwsIamPolicyDocument(
      this,
      'assume-role-policy',
      {
        statement: [
          {
            effect: 'Allow',
            principals: [
              {
                type: 'Service',
                identifiers: ['codepipeline.amazonaws.com'],
              },
            ],
            actions: ['sts:AssumeRole'],
          },
        ],
      },
    );

    const codepipelineRole = new IamRole(this, 'codepipeline-role', {
      assumeRolePolicy: codepipelineAssumeRolePolicy.json,
    });

    new IamRolePolicy(this, 'codepipeline-policy', {
      role: codepipelineRole.id,
      policy: codepipelinePermissionPolicyDocument.json,
    });

    const kmsAlias = new DataAwsKmsAlias(this, 'kms-alias', {
      name: 'alias/aws/s3',
    });

    const codebuildAssumeRolePolicyDocument = new DataAwsIamPolicyDocument(
      this,
      'codebuild-assume-role-policy-document',
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            effect: 'Allow',
            principals: [
              {
                identifiers: ['codebuild.amazonaws.com'],
                type: 'Service',
              },
            ],
          },
        ],
      },
    );

    const stateBucket = new DataAwsS3Bucket(this, 'state-bucket', {
      bucket: props.stateBucket,
    });

    const codebuildIamRole = new IamRole(this, 'codebuild-role', {
      assumeRolePolicy: codebuildAssumeRolePolicyDocument.json,
    });

    const codebuildIamPolicyDocument = new DataAwsIamPolicyDocument(
      this,
      'codebuild-iam-policy-document',
      {
        statement: [
          {
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            effect: 'Allow',
            resources: ['*'],
          },
          {
            actions: ['s3:*'],
            effect: 'Allow',
            resources: [bucket.arn, `${bucket.arn}/*`],
          },
          {
            actions: [
              's3:GetObject',
              's3:GetObjectVersion',
              's3:GetBucketVersioning',
              's3:PutObjectAcl',
              's3:PutObject',
              's3:ListBucket',
            ],
            effect: 'Allow',
            resources: [stateBucket.arn, `${stateBucket.arn}/*`],
          },
          {
            actions: ['secretsmanager:GetSecretValue'],
            effect: 'Allow',
            resources: [
              'arn:aws:secretsmanager:us-east-2:361188080279:secret:CI/scylla-UdkHbh',
            ],
          },
          {
            actions: ['codestar-connections:*'],
            effect: 'Allow',
            resources: [codeStarConnection.arn],
          },
          {
            actions: ['kms:ListAliases'],
            effect: 'Allow',
            resources: ['*'],
          },
          {
            actions: ['codebuild:BatchGetProjects', 'codepipeline:*'],
            effect: 'Allow',
            resources: ['*'],
          },
          {
            actions: ['*'],
            effect: 'Allow',
            resources: [codepipelineRole.arn, codebuildIamRole.arn],
          },
          {
            actions: ['kms:DescribeKey'],
            effect: 'Allow',
            resources: [kmsAlias.targetKeyArn],
          },
        ],
      },
    );

    new IamRolePolicy(this, 'codebuild-policy', {
      policy: codebuildIamPolicyDocument.json,
      role: codebuildIamRole.name,
    });

    const buildspecAsset = new TerraformAsset(this, 'buildspec', {
      path: './src/buildspec.yaml',
      type: AssetType.FILE,
    });

    const buildspec = Fn.templatefile(buildspecAsset.path, {
      stackId: props.targetStackId,
    });

    const codebuildProject = new CodebuildProject(this, 'codebuild', {
      name: 'scylla-codebuild',
      buildTimeout: 60,
      serviceRole: codebuildIamRole.arn,
      artifacts: {
        type: 'CODEPIPELINE',
      },
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
        image: 'aws/codebuild/standard:7.0',
        type: 'LINUX_CONTAINER',
        environmentVariable: [
          {
            name: 'CODEBUILD_CONFIG_AUTO_discover',
            type: 'PLAINTEXT',
            value: 'true',
          },
          ...props.environmentVariables,
        ],
      },
      source: {
        type: 'CODEPIPELINE',
        buildspec: buildspec,
      },
    });

    const sourceActionName = 'Source';

    new Codepipeline(this, 'codepipeline', {
      name: props.pipelineName,
      roleArn: codepipelineRole.arn,
      pipelineType: 'V2',
      trigger: [
        {
          providerType: 'CodeStarSourceConnection',
          gitConfiguration: {
            sourceActionName,
            push: [
              {
                branches: {
                  includes: [props.sourceBranch],
                },
                filePaths: {
                  includes: [`.devops/cdktf/src/${props.sourceDirectory}`],
                },
              },
            ],
          },
        },
      ],
      artifactStore: [
        {
          location: bucket.bucket,
          type: 'S3',
          encryptionKey: {
            id: kmsAlias.arn,
            type: 'KMS',
          },
        },
      ],
      stage: [
        {
          name: 'Source',
          action: [
            {
              name: sourceActionName,
              category: 'Source',
              owner: 'AWS',
              provider: 'CodeStarSourceConnection',
              version: '1',
              outputArtifacts: ['source_output'],
              configuration: {
                ConnectionArn: codeStarConnection.arn,
                FullRepositoryId: 'coopapi/coop-monorepo',
                BranchName: props.sourceBranch,
              },
            },
          ],
        },
        {
          action: [
            {
              category: 'Build',
              configuration: {
                ProjectName: codebuildProject.name,
              },
              inputArtifacts: ['source_output'],
              name: 'Build',
              outputArtifacts: ['build_output'],
              owner: 'AWS',
              provider: 'CodeBuild',
              version: '1',
            },
          ],
          name: 'Build',
        },
      ],
    });
  }
}
