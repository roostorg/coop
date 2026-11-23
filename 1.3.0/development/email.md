# Email

Coop sends emails for things like new-user invitations, password resets, and rule anomaly alerts. Admins can configure an on-call alert email in Settings -> Organization -> On-Call Alert Email.

In local development, you can set `EMAIL_TRANSPORT=console` and `NODE_ENV=development` and Coop will log outgoing emails to the console. This is good for local development, but not for production! We currently support SendGrid or Amazon SES.

## Shared settings

No matter which email provider you use, you should set the following environment variables:

- `NOREPLY_EMAIL`: where emails come from. Your email provider must be allowed to send from this address.
- `SUPPORT_EMAIL`: a support email address with an inbox you can read. This email appears at the bottom of rule-anomaly emails.
- `UI_URL`: the public base URL of your Coop instance. Do not add a trailing slash. Emails will use this to build invitation links and the like.

## SendGrid

To use SendGrid, unset `EMAIL_TRANSPORT` and set the `SENDGRID_API_KEY` environment variable.

## Amazon SES

If you'd rather use SES:

- Unset `SENDGRID_API_KEY` and `EMAIL_TRANSPORT`.
- Set `AWS_REGION` to the region where you configure SES. Your `NOREPLY_EMAIL` or its domain must be verified in this region.
- Provide AWS credentials through an IAM role attached to your workload, a shared AWS credentials profile, or the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables. Coop uses the AWS SDK's default credential provider chain.
- Ensure that you have the `ses:SendEmail` permission and that SES has production access so it can send to unverified recipients.
