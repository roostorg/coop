import { Stack, StackProps } from 'aws-cdk-lib';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import { Topic } from 'aws-cdk-lib/aws-sns';
import {
  EmailSubscription,
  UrlSubscription,
} from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

type TelemetryStackProps = StackProps & {
  forwardToOpsGenie: boolean;
  alertsSlackChannelId: string;
};

/**
 * Sets up metrics and alarms to alert us when things go haywire.
 */
export class TelemetryStack extends Stack {
  public readonly highUrgencyAlarmsTopic: Topic;
  public readonly lowUrgencyAlarmsTopic: Topic;

  constructor(scope: Construct, id: string, props: TelemetryStackProps) {
    super(scope, id, props);

    // Topic for all operational alarms.
    this.highUrgencyAlarmsTopic = new Topic(
      this,
      'OperationalAlarmNotificationsTopic',
      {
        displayName: 'Operational Alarm Notifications',
      },
    );

    this.lowUrgencyAlarmsTopic = new Topic(this, 'LowUrgencyAlarmsTopic', {
      displayName: 'Low Urgency Operational Alarm Notifications',
    });

    const slackChannel = new chatbot.SlackChannelConfiguration(
      this,
      'LowUrgencyAlertsSlackChannel',
      {
        slackChannelConfigurationName: `low-urgency-alerts-${props.alertsSlackChannelId}`,
        slackWorkspaceId: 'T02MXF4UZGS',
        slackChannelId: props.alertsSlackChannelId,
        notificationTopics: [this.lowUrgencyAlarmsTopic],
      },
    );
    if (!props.forwardToOpsGenie) {
      slackChannel.addNotificationTopic(this.highUrgencyAlarmsTopic);
    }

    // Example email subscriptions (replace with actual addresses)
    this.highUrgencyAlarmsTopic.addSubscription(
      new EmailSubscription('alerts@example.com', { json: true }),
    );
    if (props.forwardToOpsGenie) {
      this.highUrgencyAlarmsTopic.addSubscription(
        new UrlSubscription(
          'https://api.opsgenie.com/v1/json/cloudwatch?apiKey=6f86a81b-7497-4ba6-9a7e-8851fd07c651',
        ),
      );
    }
  }
}
