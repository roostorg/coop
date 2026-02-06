import { CfnOutput, Size } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  ConnectionType,
  EndpointType,
  HttpIntegration,
  LogGroupLogDestination,
  Model,
  ResponseType,
  RestApi,
  VpcLink,
  type HttpIntegrationProps,
  type QuotaSettings,
  type Resource,
  type ThrottleSettings,
} from 'aws-cdk-lib/aws-apigateway';
import type { NetworkLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import lodash from 'lodash';

const { zip, isEqual } = lodash;

export type CoopApiGatewayProps = {
  apiName: string;
  targetNlb: {
    readonly loadBalancer: NetworkLoadBalancer;
    readonly targetPort: number;
  };
  usagePlans: readonly {
    readonly id: string;
    readonly name: string;
    readonly quota?: QuotaSettings;
    readonly throttle?: ThrottleSettings;
    readonly description?: string;
  }[];
  routes: readonly { path: string; method: string; bodySchema?: any }[];
};

/**
 * This construct sets up our API Gateway, which targets the private NLB as its
 * backend (which in turn serves the api pods in k8s), using a VPC link. It's
 * not really a reusable construct [it's tightly bound to the details of our
 * server], but it does let us group and tuck away these details from our
 * higher-level code.
 *
 * The logic here is likely to grow over time, as we integrate it with the code
 * for our API server, to automatically configure the gateway for new endpoints
 * and/or usage plans as those are needed.
 */
export class CoopApiGateway extends Construct {
  // map from coop plan ids to the AWS-assigned usage plan id.
  public readonly apiUsagePlanIds: { [coopPlanId: string]: string };
  public readonly restApi: RestApi;

  constructor(scope: Construct, name: string, props: CoopApiGatewayProps) {
    super(scope, name);

    // Create a VPC link that will allow API Gateway to talk to the private load balancer.
    const { loadBalancer: nlb, targetPort: targetNlbPort } = props.targetNlb;
    const vpcLink = new VpcLink(this, 'api-service-link', { targets: [nlb] });

    // Our API Gateway is only going to have one stage, because we have entirely
    // different gateways for our different environments. The stage will be
    // called latest, and it'll be created implicitly from the settings below.
    // The stage will target the deployment that's also implicitly created by
    // our CDK config below.
    // TODO: it might be cheaper to have one gateway with multiple stages, it's
    // more complex -- with stage variables etc for the backends -- so we don't
    // bother for now.
    const gatewayApi = new RestApi(this, 'api-gateway-api', {
      deploy: true,
      // the default is edge-optimized which deploys a fully managed (and
      // hidden) cloudfront distribution in front of APIG. We manage our own
      // distro so we don't need it.
      endpointConfiguration: { types: [EndpointType.REGIONAL] },
      deployOptions: {
        stageName: 'latest',
        accessLogDestination: new LogGroupLogDestination(
          new LogGroup(this, 'api-gateway-access-logs', {
            retention: RetentionDays.ONE_DAY,
          }),
        ),
        metricsEnabled: true,
        tracingEnabled: true,
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
      restApiName: props.apiName,
      minCompressionSize: Size.kibibytes(1), // ChatGPT says 1KB is a good threshold here
    });

    gatewayApi.addGatewayResponse('BadRequestGatewayResponse', {
      type: ResponseType.BAD_REQUEST_BODY,
      statusCode: '400',
      templates: {
        'application/json': '{"message": $context.error.validationErrorString}',
      },
    });

    this.restApi = gatewayApi;

    const usagePlans = props.usagePlans.map((plan) =>
      gatewayApi.addUsagePlan(plan.id, {
        apiStages: [{ stage: gatewayApi.deploymentStage, api: gatewayApi }],
        ...plan,
      }),
    );

    this.apiUsagePlanIds = Object.fromEntries(
      zip(
        props.usagePlans.map((it) => it.id),
        usagePlans.map((it) => it.usagePlanId),
      ) as [string, string][],
    );

    const validators = {
      all: gatewayApi.addRequestValidator('allValidator', {
        requestValidatorName: 'all',
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      bodyOnly: gatewayApi.addRequestValidator('bodyOnlyValidator', {
        requestValidatorName: 'body-only',
        validateRequestBody: true,
        validateRequestParameters: false,
      }),
      paramsOnly: gatewayApi.addRequestValidator('paramsOnlyValidator', {
        requestValidatorName: 'params-only',
        validateRequestBody: false,
        validateRequestParameters: true,
      }),
    };

    const targetBaseUrl = `http://${nlb.loadBalancerDnsName}:${targetNlbPort}`;

    const integrationRequestParameters: { [key: string]: string } = {
      'integration.request.header.original-host': 'method.request.header.host',
    };

    const proxyOptions: HttpIntegrationProps = {
      proxy: true,
      httpMethod: 'ANY',
      options: {
        connectionType: ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: integrationRequestParameters,
      },
    };

    // Setting this to optional (false) just to make sure it doesn't break
    // anything even though every request should have a host header.
    const methodRequestParameters: { [key: string]: boolean } = {
      'method.request.header.host': false,
    };

    const apiV1BaseResource = gatewayApi.root
      .addResource('api')
      .addResource('v1');

    // We must define a different resource for every path segment, as
    // required by API Gateway. So we use resourcesMap to keep track of those;
    // we can't simply define them as we go (reducing over path segments) or
    // we'll get an error if we try to define the same resource twice.
    // `/` at the root refers to the starting point of `/api/v1`.
    // NB: some unsafe casing here because of https://github.com/microsoft/TypeScript/issues/17867
    type ResourcesMap = { '/': Resource } & { [K in string]?: ResourcesMap };
    const resourcesMap = { '/': apiV1BaseResource } as ResourcesMap;

    // As with the resources above, multiple endpoints might use the same model,
    // so we keep a cache of all the models to prevent trying to define the same
    // one twice. NB: if two models have the same name, we'll verify that their
    // schema's are deeply equal. (If they're not, there's a legit error.)
    const models = new Map<string, { schema: any; model: Model }>();

    for (const route of props.routes) {
      // replace express-style url parameters w/ api gateway ones,
      // i.e., ":id" to "{id}", and trim leading and trailing slashes.
      const apiGatewayPath = route.path
        .replace(/(:([^/]*))(\/?)/g, '{$2}$3')
        .replace(/(^\/)|(\/$)/g, '')
        .replace(/\/\//g, '/');

      const pathSegments = apiGatewayPath.split('/');
      const resource = (() => {
        let resource = apiV1BaseResource;
        let parentMap = resourcesMap;
        for (const pathSegment of pathSegments) {
          if (parentMap[pathSegment]) {
            resource = parentMap[pathSegment]!['/'];
          } else {
            resource = parentMap['/'].addResource(pathSegment);
            parentMap[pathSegment] = { '/': resource } as ResourcesMap;
          }
          parentMap = parentMap[pathSegment]!;
        }
        return resource;
      })();

      const apiGatewayMethod = route.method.toUpperCase();

      // GET requests don't have a body, so we don't need to define a model for
      // them.
      const model = route.bodySchema
        ? (() => {
            const modelName = (
              route.bodySchema.title || `${apiGatewayMethod}-${apiGatewayPath}`
            )
              .replace(/[^a-zA-Z0-9]/g, '')
              .substr(0, 55);
            const { model, schema } = models.get(modelName) ?? {};
            if (!model) {
              const newModel = new Model(this, modelName, {
                modelName,
                restApi: gatewayApi,
                schema: route.bodySchema,
              });

              models.set(modelName, {
                schema: route.bodySchema,
                model: newModel,
              });

              return newModel;
            }

            if (!isEqual(schema, route.bodySchema)) {
              throw new Error(
                `Model ${modelName} already defined with different schema`,
              );
            }

            return model;
          })()
        : undefined;

      resource.addMethod(
        apiGatewayMethod,
        new HttpIntegration(`${targetBaseUrl}/api/v1/${apiGatewayPath}`, {
          ...proxyOptions,
          httpMethod: apiGatewayMethod,
        }),
        {
          ...(model ? { requestModels: { 'application/json': model } } : {}),
          requestValidator: validators.bodyOnly,
          apiKeyRequired: true,
          requestParameters: methodRequestParameters,
        },
      );
    }

    // Proxy all other requests to /api/v1/* to the API server, but require an
    // API key, except for calls to /api/v1/graphql, /api/v1/saml/login, and
    // /api/v1/saml/login/callback, which do not use API gateway API keys for
    // auth/rate limiting.
    apiV1BaseResource.addResource('graphql').addMethod(
      'ANY',
      new HttpIntegration(`${targetBaseUrl}/api/v1/graphql`, {
        ...proxyOptions,
      }),
      { apiKeyRequired: false, requestParameters: methodRequestParameters },
    );

    const samlLoginResource = apiV1BaseResource
      .addResource('saml')
      .addResource('login')
      .addResource('{orgId}');

    samlLoginResource.addMethod(
      'GET',
      new HttpIntegration(`${targetBaseUrl}/api/v1/saml/login/{orgId}`, {
        ...proxyOptions,
        options: {
          ...proxyOptions.options,
          requestParameters: {
            ...integrationRequestParameters,
            'integration.request.path.orgId': 'method.request.path.orgId',
          },
        },
      }),
      {
        apiKeyRequired: false,
        requestParameters: {
          ...methodRequestParameters,
          'method.request.path.orgId': true,
        },
      },
    );

    samlLoginResource.addResource('callback').addMethod(
      'POST',
      new HttpIntegration(
        `${targetBaseUrl}/api/v1/saml/login/{orgId}/callback`,
        {
          ...proxyOptions,
          options: {
            ...proxyOptions.options,
            requestParameters: {
              ...integrationRequestParameters,
              'integration.request.path.orgId': 'method.request.path.orgId',
            },
          },
        },
      ),
      {
        apiKeyRequired: false,
        requestParameters: {
          ...methodRequestParameters,
          'method.request.path.orgId': true,
        },
      },
    );

    apiV1BaseResource.addProxy({
      defaultMethodOptions: {
        apiKeyRequired: true,
        requestParameters: {
          ...methodRequestParameters,
          'method.request.path.proxy': true,
        },
      },
      defaultIntegration: new HttpIntegration(
        `${targetBaseUrl}/api/v1/{proxy}`,
        {
          ...proxyOptions,
          options: {
            ...proxyOptions.options,
            requestParameters: {
              ...integrationRequestParameters,
              'integration.request.path.proxy': 'method.request.path.proxy',
            },
          },
        },
      ),
    });

    // Proxy requests to the root endpoint ("/"), and to an endpoint _not_ under
    // "/api/v1" to the API server as well, since it currently serves static
    // files. Still, we set up these api gateway routes/methods separately,
    // since static file serving isn't subject to the same authentication and
    // rate limiting rules, and might move to a different (S3) backend later.
    gatewayApi.root.addMethod(
      'ANY',
      new HttpIntegration(targetBaseUrl, {
        ...proxyOptions,
      }),
      {
        requestParameters: methodRequestParameters,
        apiKeyRequired: false,
      },
    );

    gatewayApi.root.addProxy({
      defaultMethodOptions: {
        apiKeyRequired: false,
        requestParameters: {
          ...methodRequestParameters,
          'method.request.path.proxy': true,
        },
      },
      defaultIntegration: new HttpIntegration(targetBaseUrl + '/{proxy}', {
        ...proxyOptions,
        options: {
          ...proxyOptions.options,
          requestParameters: {
            ...integrationRequestParameters,
            'integration.request.path.proxy': 'method.request.path.proxy',
          },
        },
      }),
    });

    // output load balancer hostname for debugging.
    new CfnOutput(this, 'lb-url', { value: nlb.loadBalancerDnsName });
  }
}
