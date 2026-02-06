import sgMail, { type MailDataRequired } from '@sendgrid/mail';

export const CoopEmailAddress = {
  NoReply: process.env.NOREPLY_EMAIL ?? 'noreply@example.com',
  Support: process.env.SUPPORT_EMAIL ?? 'support@example.com',
  Team: process.env.TEAM_EMAIL ?? 'team@example.com',
} as const;

export type CoopEmailAddress =
  (typeof CoopEmailAddress)[keyof typeof CoopEmailAddress];

type Content = { text: string } | { html: string } | { templateId: string };

export type Message = Omit<MailDataRequired, 'from' | 'content'> &
  Content & {
    from: CoopEmailAddress | { name: string; email: CoopEmailAddress };
  };

const makeSendEmail = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    // Return a no-op function if SendGrid is not configured
    return async (_: Message) => {
      // eslint-disable-next-line no-console
      console.warn('SendGrid API key not configured, skipping email sending');
    };
  }
  sgMail.setApiKey(apiKey);
  return async (it: Message) => {
    try {
      await sgMail.send(it);
    } catch (error) {
      // Log the error but don't throw - email failures shouldn't break the application
      // This handles cases like invalid API keys, network errors, etc.
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error('Failed to send email:', error.message);
      }
    }
  };
};

export default makeSendEmail;

// nb: this is a simplified version of the sendgrid send() function's api,
// reflecting the subset that we're currently using. we start by exposing a
// simplified api b/c it makes it (much) easier to mock and assert on in unit
// tests, but we may expand this as needed.
export type SendEmail = ReturnType<typeof makeSendEmail>;
