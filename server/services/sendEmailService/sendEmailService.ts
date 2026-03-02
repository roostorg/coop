import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import sgMail from '@sendgrid/mail';

export const CoopEmailAddress = {
  NoReply: process.env.NOREPLY_EMAIL ?? 'noreply@example.com',
  Support: process.env.SUPPORT_EMAIL ?? 'support@example.com',
  Team: process.env.TEAM_EMAIL ?? 'team@example.com',
} as const;

export type CoopEmailAddress =
  (typeof CoopEmailAddress)[keyof typeof CoopEmailAddress];

type Content =
  | { text: string; html?: string }
  | { html: string; text?: string };

export type Message = Content & {
  to: string | string[];
  from: CoopEmailAddress | { name: string; email: CoopEmailAddress };
  subject: string;
};

const isSESClient = (x: unknown): x is SESClient =>
  x != null && typeof (x as SESClient).send === 'function';

export function makeSendEmailViaSES(client: SESClient) {
  return async (msg: Message) => {
    const source =
      typeof msg.from === 'string'
        ? msg.from
        : `${msg.from.name} <${msg.from.email}>`;

    const toAddresses = Array.isArray(msg.to) ? msg.to : [msg.to];

    const body: Record<string, { Charset: string; Data: string }> = {};
    if ('html' in msg && msg.html) {
      body.Html = { Charset: 'UTF-8', Data: msg.html };
    }
    if ('text' in msg && msg.text) {
      body.Text = { Charset: 'UTF-8', Data: msg.text };
    }

    const command = new SendEmailCommand({
      Source: source,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: { Charset: 'UTF-8', Data: msg.subject },
        Body: body,
      },
    });

    try {
      await client.send(command);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error('Failed to send email:', error.message);
      }
    }
  };
}

export function makeSendEmailViaSendGrid(apiKey: string) {
  sgMail.setApiKey(apiKey);
  return async (msg: Message) => {
    try {
      await sgMail.send(msg);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error('Failed to send email:', error.message);
      }
    }
  };
}

const makeSendEmail = (clientOrContainer?: SESClient | unknown) => {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  if (sendGridApiKey) {
    return makeSendEmailViaSendGrid(sendGridApiKey);
  }

  const sesClient = isSESClient(clientOrContainer)
    ? clientOrContainer
    : new SESClient({});
  return makeSendEmailViaSES(sesClient);
};

export default makeSendEmail;

// nb: this is a simplified version of the sendgrid send() function's api,
// reflecting the subset that we're currently using. we start by exposing a
// simplified api b/c it makes it (much) easier to mock and assert on in unit
// tests, but we may expand this as needed.
export type SendEmail = ReturnType<typeof makeSendEmail>;
