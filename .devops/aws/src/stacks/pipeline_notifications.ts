import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { INotificationRuleTarget } from 'aws-cdk-lib/aws-codestarnotifications';
import { FilterOrPolicy, SubscriptionFilter } from 'aws-cdk-lib/aws-sns';
import { UrlSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

import { GithubPipelineNotificationRuleTarget } from '../constructs/GithubPipelineNotificationRuleTarget.js';

/**
 * Deploys an SNS Topic that can receive notifications about a pipeline's status
 * and update Github to reflect the status.
 *
 * NB: by making this its own stack, it's possible to deploy it only once and
 * share the same SNS topic between our deploy-to-demo and deploy-to-prod
 * pipelines. It also presumably makes each pipeline's SelfUpdate step a touch
 * faster. However, because this stack exists outside of our pipelines' stacks,
 * it will not self-update from new source, so it'll have to be manually
 * redeployed (using `cdk deploy`) if it ever changes.
 */
export class PipelineNotificationsStack extends Stack {
  public notificationsTarget: INotificationRuleTarget;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const targetConstruct = new GithubPipelineNotificationRuleTarget(
      this,
      'GithubPipelineNotificationRuleTarget',
      { githubToken: SecretValue.secretsManager('github-token').toString() },
    );
    targetConstruct.target.addSubscription(
      new UrlSubscription(
        'https://api.opsgenie.com/v1/json/amazonsns?apiKey=d6b90baf-5084-4202-80f8-4b633f18c213',
        {
          filterPolicyWithMessageBody: {
            detail: FilterOrPolicy.policy({
              pipeline: FilterOrPolicy.filter(
                SubscriptionFilter.stringFilter({
                  // in the future I'd like to get notifications for staging as
                  // well, but right now it is to noisy and I don't want to page
                  // people for it
                  allowlist: ['APIServer_ReactApp_Pipeline_Prod'],
                }),
              ),
              state: FilterOrPolicy.filter(
                SubscriptionFilter.stringFilter({
                  allowlist: ['FAILED'],
                }),
              ),
            }),
          },
        },
      ),
    );
    this.notificationsTarget = targetConstruct.target;
  }
}
