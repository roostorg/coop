import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

type Props = {
  alarm: Alarm;
  topic: ITopic;
};

/**
 * Adds notifications, to an SNS topic, for when an alarm changes state.
 */
export class SnsAlarmStateChangeNotifications extends Construct {
  constructor(scope: Construct, name: string, props: Props) {
    super(scope, name);

    props.alarm.addAlarmAction(new SnsAction(props.topic));
    props.alarm.addOkAction(new SnsAction(props.topic));
    props.alarm.addInsufficientDataAction(new SnsAction(props.topic));
  }
}

/**
 * Takes an existing alarm that's already defined in a scope, and adds SNS
 * notifications for its state change (w/ these notification resources defined
 * in the same scope). The side effects here feel gross, but welcome to CDK.
 */
export function withSnsNotifications(alarm: Alarm, topic: ITopic) {
  new SnsAlarmStateChangeNotifications(
    alarm.node.scope!,
    `${alarm.node.id}Notifications`,
    { alarm, topic },
  );
}
