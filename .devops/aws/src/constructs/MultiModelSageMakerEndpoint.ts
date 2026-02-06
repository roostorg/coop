import assert from 'assert';
import * as sagemaker_alpha from '@aws-cdk/aws-sagemaker-alpha';
import { Duration, Stack } from 'aws-cdk-lib';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { CfnModel } from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

type MultiModelSageMakerEndpointProps = {
  vpc: IVpc;
  instanceType: sagemaker_alpha.InstanceType;
  autoscaling?: {
    minInstanceCount: number;
    maxInstanceCount: number;
    autoscalingModelLatencyMetricTrackingTarget: Duration;
  };
  initialInstanceCount: number;
  modelData?: sagemaker_alpha.ModelData;
  image?: sagemaker_alpha.ContainerImage;
};

export class MultiModelSageMakerEndpoint extends Construct {
  readonly endpoint: sagemaker_alpha.IEndpoint;

  constructor(
    scope: Construct,
    name: string,
    props: MultiModelSageMakerEndpointProps,
  ) {
    super(scope, name);

    const { endpoint } =
      unsafe_addLegacyMultiModelSageMakerEndpointResourcesInScope(this, props);

    this.endpoint = endpoint;
  }
}

function getDefaultTritonContainerImage(scope: Construct) {
  // Image URL for Triton Inference server, which allows us to host models with
  // GPU acceleration for a number of popular ML frameworks. See here for more
  // info:
  // https://docs.aws.amazon.com/sagemaker/latest/dg/multi-model-endpoints.html#multi-model-support
  // NB: This image is currently expected to exist in a private repository in
  // the deploying AWS account. See here for all other image URLs:
  // https://github.com/aws/deep-learning-containers/blob/master/available_images.md
  const { account, region } = Stack.of(scope);

  assert(
    region === 'us-east-2',
    'SageMaker Multi-Model endpoint image URL can only be generated for us-east-2.',
  );
  const TRITON_SERVER_VERSION = '23.07-py3';

  return sagemaker_alpha.ContainerImage.fromEcrRepository(
    Repository.fromRepositoryArn(
      scope,
      'TritonServerRepo',
      `arn:aws:ecr:${region}:${account}:repository/sagemaker-tritonserver`,
    ),
    TRITON_SERVER_VERSION,
  );
}

/**
 * @deprecated This function is used to DRY up the code for the MultiModelSageMakerEndpoint
 * construct above and the code for a legacy endpoint that was created before the
 * construct existed. It should not be used directly for new endpoints, as it adds
 * resources directly to the passed in scope, with logical ids that could in theory conflict
 * with existing ids in that scope.
 *
 * Because of the risk for conflicts, no new resources should be added in this function.
 * Instead, new resources should only be added directly in the construct above.
 */
export function unsafe_addLegacyMultiModelSageMakerEndpointResourcesInScope(
  scope: Construct,
  props: MultiModelSageMakerEndpointProps,
) {
  const {
    vpc,
    instanceType,
    image = getDefaultTritonContainerImage(scope),
    modelData,
    autoscaling,
  } = props;

  // Create model configuration. This is configured as part of a single
  // multi-model endpoint running NVIDIA Triton inference server, and is
  // intended to be the single container that hosts all the models for this
  // endpoint.
  const model = new sagemaker_alpha.Model(scope, 'PrimarySageMakerModel', {
    vpc,
    containers: [
      {
        image,
        modelData,
        environment: {
          // https://github.com/triton-inference-server/server/blob/6cab4bbe14d79d5d4f1cc94d5191dfcc06fb0b5e/docker/sagemaker/serve#L100-L111
          SAGEMAKER_TRITON_LOG_VERBOSE: 'false',
          SAGEMAKER_TRITON_LOG_INFO: 'false',
          SAGEMAKER_TRITON_LOG_WARNING: 'true',
        },
      },
    ],
  });

  // Inject multi-model config properties that are not supported by the L2 constructs.
  const cfnModel = model.node.children.filter(
    (c) => c instanceof CfnModel,
  )[0] as CfnModel;
  cfnModel.addPropertyOverride('PrimaryContainer.Mode', 'MultiModel');
  cfnModel.addPropertyOverride(
    'PrimaryContainer.MultiModelConfig.ModelCacheSetting',
    'Enabled',
  );

  // Create endpoint configuration, pairing model with compute resources.
  const PRODUCTION_VARIANT_NAME = 'AllTraffic';

  const endpointConfig = new sagemaker_alpha.EndpointConfig(
    scope,
    'PrimarySageMakerModelEndpointConfig',
    {
      instanceProductionVariants: [
        {
          model,
          variantName: PRODUCTION_VARIANT_NAME,
          // https://docs.aws.amazon.com/sagemaker/latest/dg/multi-model-endpoints.html#multi-model-support-gpu
          instanceType,
          initialInstanceCount: props.initialInstanceCount,
        },
      ],
    },
  );

  // Create the endpoint.
  const endpoint = new sagemaker_alpha.Endpoint(
    scope,
    'PrimarySageMakerModelEndpoint',
    {
      endpointConfig: endpointConfig,
    },
  );

  const productionVariant = endpoint.findInstanceProductionVariant(
    PRODUCTION_VARIANT_NAME,
  );

  // Autoscaling groups are not supported for burstable instance types (t2).
  if (!props.instanceType.toString().includes('ml.t2') && autoscaling) {
    const scalableTarget = new appscaling.ScalableTarget(
      scope,
      'ClassificationEndpointScalableTarget',
      {
        serviceNamespace: appscaling.ServiceNamespace.SAGEMAKER,
        maxCapacity: autoscaling.maxInstanceCount,
        minCapacity: autoscaling.minInstanceCount,
        resourceId: `endpoint/${endpoint.endpointName}/variant/${PRODUCTION_VARIANT_NAME}`,
        scalableDimension: 'sagemaker:variant:DesiredInstanceCount',
      },
    );
    scalableTarget.scaleToTrackMetric('ModelLatencyTracking', {
      // This metric's actual target value is in microseconds. 1 millisecond is
      // 1000 microseconds.
      targetValue:
        autoscaling.autoscalingModelLatencyMetricTrackingTarget.toMilliseconds() *
        1000,
      customMetric: productionVariant.metricModelLatency({
        period: Duration.seconds(30),
      }),
    });
  }

  return { endpoint };
}
