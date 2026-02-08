import path from 'path';
import { fileURLToPath } from 'url';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

import { repoRootDir } from '../../constants.js';
import { DeploymentEnvironmentName } from '../app_pipeline.js';

type Domain = {
  certificateArn: string;
  domainName: string;
  hostedZoneId: string;
};

type CloudfrontStackProps = StackProps & {
  restApi: RestApi;
  provisionProdLevelsOfCompute: boolean;
  stage: DeploymentEnvironmentName;
  deleteStatefulResources: boolean;
  domain: Domain;
  vpc: IVpc;
  otelCollectorUrl: string;
};

export class CloudfrontStack extends Stack {
  constructor(scope: Construct, id: string, props: CloudfrontStackProps) {
    super(scope, id, props);

    const uiLoggingBucket = new s3.Bucket(this, 'LoggingBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const uiCodeBucket = new s3.Bucket(this, 'CodeBucket', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: uiLoggingBucket,
      serverAccessLogsPrefix: 's3-access-logs',
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: props.deleteStatefulResources,
      removalPolicy: props.deleteStatefulResources
        ? cdk.RemovalPolicy.DESTROY
        : cdk.RemovalPolicy.RETAIN,
    });

    // Ideally, this statement would live in the cloudfront stack and the policy
    // statement would be scoped to the cloudfront distribution in front of it.
    // However, there is a cdk limitation where if we were to do that it would
    // introduce a circular dependency between the UI and cloudfront stacks.
    // This is because we suspect cdk lifts the addToResourcePolicy method into
    // the stack which creates the bucket so that it can compose the policy at
    // bucket creation time. As a workaround, we have moved the statement into
    // this stack and removed the distribution Id to produce an iam policy that
    // at least restricts access to any cloudfront distro as opposed to
    // allowing full public access
    uiCodeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [`${uiCodeBucket.bucketArn}/*`, uiCodeBucket.bucketArn],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      }),
    );

    const edgeLambda = new cloudfront.experimental.EdgeFunction(
      this,
      'RedirectLambda',
      {
        runtime: Runtime.NODEJS_24_X,
        code: Code.fromAsset(
          path.join(path.dirname(fileURLToPath(import.meta.url)), './redirect'),
        ),
        handler: 'redirectEdgeLambda.handler',
      },
    );

    const cachePolicy = new cloudfront.CachePolicy(
      this,
      `${props.stage}ApiCachePolicy`,
      {
        cachePolicyName: `${props.stage}ApiGatewayCachePolicy`,
        cookieBehavior: cloudfront.CacheCookieBehavior.all(),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
        defaultTtl: cdk.Duration.days(0),
        // cache by org
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList('x-api-key'),
      },
    );

    const coopDistribution = new CoopCloudfrontDistribution(
      this,
      `${props.domain.domainName}CloudfrontDistro`,
      {
        ...props,
        uiCodeBucket,
        uiLoggingBucket,
        edgeLambda,
        cachePolicy,
      },
    );

    // Deploy the SPA content to the S3 bucket. This is in this stack because it
    // has a dependency on the cloudfront distribution in order to invalidate
    // the cache
    new s3deploy.BucketDeployment(this, 'SpaDeployment', {
      distribution: coopDistribution.distribution,
      sources: [
        s3deploy.Source.asset('../../client', {
          ignoreMode: cdk.IgnoreMode.DOCKER,
          bundling: {
            image: cdk.DockerImage.fromBuild(`${repoRootDir}/client`, {
              buildArgs: {
                NPM_TOKEN: process.env.NPM_TOKEN as string,
                REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
                  props.otelCollectorUrl,
              },
            }),
            user: 'root',
            command: ['bash', '-c', 'cp -r /app/build/* /asset-output'],
          },
        }),
      ],

      destinationBucket: uiCodeBucket,
      logRetention: RetentionDays.ONE_WEEK,
      memoryLimit: 1024,
      // the bundle is so large that I enabled EFS so the lambda doesn't run out
      // of disk space
      useEfs: true,
      vpc: props.vpc,
    });
  }
}

type CoopCloudfrontDistributionProps = {
  stage: string;
  provisionProdLevelsOfCompute: boolean;
  uiCodeBucket: s3.IBucket;
  uiLoggingBucket: s3.IBucket;
  restApi: RestApi;
  edgeLambda: lambda.IVersion;
  cachePolicy: cloudfront.CachePolicy;
  domain: Domain;
};

class CoopCloudfrontDistribution extends Construct {
  public readonly distribution: cloudfront.Distribution;
  constructor(
    scope: Construct,
    name: string,
    props: CoopCloudfrontDistributionProps,
  ) {
    super(scope, name);
    const {
      uiCodeBucket,
      provisionProdLevelsOfCompute,
      uiLoggingBucket,
      edgeLambda,
      domain: { domainName },
      cachePolicy,
    } = props;
    const cloudfrontOac = new cloudfront.CfnOriginAccessControl(
      this,
      `${domainName}CloudFrontOAC`,
      {
        originAccessControlConfig: {
          name: `${props.stage}-${domainName}-ui-oai`,
          originAccessControlOriginType: 's3',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
          description: 'OAI for S3 Bucket hosting our UI static assets.',
        },
      },
    );

    const cfDistribution = new cloudfront.Distribution(
      this,
      `${domainName}CloudFrontDistribution`,
      {
        domainNames: [domainName],
        certificate: Certificate.fromCertificateArn(
          this,
          `${domainName}-ssl-cert`,
          props.domain.certificateArn,
        ),
        priceClass: provisionProdLevelsOfCompute
          ? cloudfront.PriceClass.PRICE_CLASS_ALL
          : cloudfront.PriceClass.PRICE_CLASS_100,
        defaultBehavior: {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          edgeLambdas: [
            {
              functionVersion: edgeLambda,
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            },
          ],
          origin: new origins.S3Origin(uiCodeBucket, {
            originId: 's3-static-frontend',
          }),
        },
        defaultRootObject: 'index.html',
        logBucket: uiLoggingBucket,
      },
    );

    const cfCfnDistribution = cfDistribution.node
      .defaultChild as cloudfront.CfnDistribution;

    cfCfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      cloudfrontOac.getAtt('Id'),
    );
    cfCfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      '',
    );

    cfDistribution.addBehavior(
      'api/*',
      new origins.RestApiOrigin(props.restApi, {}),
      {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        compress: true,
        cachePolicy,
      },
    );

    const zone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      `${domainName}-zone`,
      { hostedZoneId: props.domain.hostedZoneId, zoneName: domainName },
    );

    new route53.ARecord(this, `${domainName}-alias`, {
      zone,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(cfDistribution),
      ),
      // * You can specify the fully qualified domain name which terminates with a
      // * ".". For example, "acme.example.com.".
      recordName: `${domainName}.`,
      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html#replacing-existing-record-sets-dangerous
      // We are adding this resource in the same commit that we remove the record that points to API Gateway
      deleteExisting: true,
    });

    new route53.AaaaRecord(this, `${domainName}-aaaa-record`, {
      zone,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(cfDistribution),
      ),
      // * You can specify the fully qualified domain name which terminates with a
      // * ".". For example, "acme.example.com.".
      recordName: `${domainName}.`,
      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html#replacing-existing-record-sets-dangerous
      // We are adding this resource in the same commit that we remove the record that points to API Gateway
      deleteExisting: true,
    });

    this.distribution = cfDistribution;
  }
}
