import * as cdk from 'aws-cdk-lib';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { KubernetesObjectValue } from 'aws-cdk-lib/aws-eks';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import type { Construct } from 'constructs';

import { makeKubectlVersionProps } from '../constants.js';
import {
  clusterFromAttributes,
  type VersionAgnosticClusterAttributes,
} from '../constructs/clusterFromAttributes.js';
import { KubernetesSecretsIntegration } from '../constructs/KubernetesSecretsIntegration.js';
import {
  getInstrumentationPodAnnotations,
  getTracingEnvVars,
} from '../utils.js';
import type { DeploymentEnvironmentName } from './app_pipeline.js';

type ContentProxyStackProps = cdk.StackProps & {
  readonly clusterAttributes: VersionAgnosticClusterAttributes;
  namespace: string;
  zoneName: string;
  hostedZoneId: string;
  subdomain?: string;
  environment: DeploymentEnvironmentName;
};

export class ContentProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ContentProxyStackProps) {
    super(scope, id, props);

    const {
      clusterAttributes,
      namespace,
      hostedZoneId,
      subdomain,
      zoneName,
      environment,
    } = props;

    const cluster = clusterFromAttributes(this, 'BackendCluster', {
      ...clusterAttributes,
      ...makeKubectlVersionProps(this),
    });

    const dockerImageAsset = new DockerImageAsset(this, 'content-proxy-image', {
      directory: '../../content-proxy',
      platform: Platform.LINUX_AMD64,
    });

    const fullyQualifiedDomain = subdomain
      ? `content-${subdomain}.${zoneName}`
      : `content.${zoneName}`;

    const zone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      `${fullyQualifiedDomain}-zone`,
      { hostedZoneId, zoneName },
    );

    const secretsIntegration = new KubernetesSecretsIntegration(
      this,
      'content-proxy-secrets',
      {
        cluster,
        namespace,
        secrets: {
          GOOGLE_TRANSLATE_API_KEY: [
            'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/notionProxy/googleTranslate-vYzPOb',
            'apiKey',
          ],
        },
      },
    );

    const chartAsset = new Asset(this, 'chart', {
      path: '../charts/app',
    });
    const release = 'content-proxy';
    const port = 4000;
    const values = secretsIntegration.injectSecretsIntoCoopAppChart({
      image: {
        repository: dockerImageAsset.repository.repositoryUri,
        tag: dockerImageAsset.imageTag,
      },
      ingress: {
        enabled: true,
        className: 'alb',
        annotations: {
          'alb.ingress.kubernetes.io/target-type': 'ip',
          'alb.ingress.kubernetes.io/healthcheck-path': '/api/v1/ready',
          'alb.ingress.kubernetes.io/scheme': 'internet-facing',
          'alb.ingress.kubernetes.io/certificate-arn':
            'arn:aws:acm:us-east-2:361188080279:certificate/424a3a55-72a3-42ee-8b4d-fb5f44c20d64',
        },
        hosts: [
          {
            host: fullyQualifiedDomain,
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
              },
            ],
          },
        ],
      },
      env: [
        ...getTracingEnvVars(release, environment),
        { name: 'DD_VERSION', value: dockerImageAsset.imageTag },
        { name: 'PORT', value: port.toString() },
        { name: 'CONTENT_BASE_URL', value: 'https://www.example.com' }, 
      ],
      service: {
        port,
      },
      podAnnotations: {
        ...getInstrumentationPodAnnotations('app'),
      },
    });

    // Deploy the Helm chart
    const helmChart = cluster.addHelmChart('helmchart', {
      chartAsset,
      release,
      namespace,
      values,
    });

    const albHostNameName = new KubernetesObjectValue(
      this,
      'content-alb-domain-name',
      {
        cluster,
        objectType: 'ingress',
        objectNamespace: namespace,
        objectName: `${release}-app`,
        jsonPath: '.status.loadBalancer.ingress[0].hostname',
      },
    );
    albHostNameName.node.addDependency(helmChart);

    new route53.CnameRecord(this, `${fullyQualifiedDomain}-alias`, {
      recordName: fullyQualifiedDomain,
      zone,
      domainName: albHostNameName.value,
    });
  }
}
