import { Stack, StackProps } from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Patterns from 'aws-cdk-lib/aws-route53-patterns';
import { Construct } from 'constructs';

export class RedirectStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const coopApiZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      `protegapicom-zone`,
      { hostedZoneId: 'Z022213221KA7T0MEI6T', zoneName: 'coopapi.com' },
    );

    // Create a permanent redirect from docs.coopapi.com to docs.getcoop.com
    new route53Patterns.HttpsRedirect(this, 'CoopApiDocsRedirect', {
      recordNames: ['docs.coopapi.com'],
      targetDomain: 'docs.getcoop.com',
      zone: coopApiZone,
    });

    // Ditto for www.getcoop.com to getcoop.com
    new route53Patterns.HttpsRedirect(this, 'GetCoopRemoveWWWRedirect', {
      recordNames: ['www.getcoop.com'],
      targetDomain: 'getcoop.com',
      zone: route53.HostedZone.fromHostedZoneAttributes(
        this,
        `getcoopcom-zone`,
        { hostedZoneId: 'Z07450291QP6IF7MO9JGS', zoneName: 'getcoop.com' },
      ),
    });

    // Ditto from coopapi.com and www.coopapi.com to getcoop.com
    new route53Patterns.HttpsRedirect(this, 'CoopApiToGetCoopRedirect', {
      recordNames: ['www.coopapi.com', 'coopapi.com'],
      targetDomain: 'getcoop.com',
      zone: coopApiZone,
    });
  }
}
