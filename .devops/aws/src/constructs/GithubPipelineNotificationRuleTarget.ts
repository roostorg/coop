import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Duration } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

const __dirname = dirname(fileURLToPath(import.meta.url));

type Props = {
  githubToken: string;
};

/**
 * Returns an SNS topic that Pipelines can publish notification messages to
 * (using the CodestarNotification system). These messages will then be picked
 * up by a lambda, which uses them to notify github of the pipeline's status.
 *
 * This SNS topic can be hooked up to any pipeline, because the pipeline's
 * message indicates the repo name + commit SHA that the pipeline run applies to.
 *
 * The only requirement is that this construct be passed a token that the github
 * API can use to update that repo's status.
 *
 * You'd think that we wouldn't need CodePipeline -> CodeStarNotifications ->
 * SNS -> Lambda, given that AWS already has EventBridge, which is a service
 * that can act as an event bus and trigger lambdas. But, for whatever reason,
 * Codepipeline can't publish events into EventBridge, and the
 * CodeStarNotifcationRule system can't directly call lambda, so we end up here.
 */
export class GithubPipelineNotificationRuleTarget extends Construct {
  public target: Topic;

  constructor(scope: Construct, name: string, props: Props) {
    super(scope, name);
    const { githubToken } = props;

    // Function that will receive notifications of changes in the pipeline's
    // status and send them to github, via the SNS topic defined below.
    const fn = new lambda.Function(this, 'PipelineStatusChangeHandler', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'index.pipeline_status_changed_handler',
      code: Code.fromInline(
        readFileSync(path.join(__dirname, './notify-github-handler.py'), {
          encoding: 'utf-8',
        }),
      ),
      timeout: Duration.seconds(30),
      environment: { GITHUB_ACCESS_TOKEN: githubToken },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['codepipeline:GetPipelineExecution'],
          resources: ['arn:aws:codepipeline:*:*:*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: ['arn:aws:logs:*:*:*'],
        }),
      ],
    });

    this.target = new Topic(this, 'GithubPipelineNotificationsTopic', {});
    this.target.addSubscription(new LambdaSubscription(fn));
  }
}
