import env from '#start/env';

/**
 * Outbound email.
 *
 * `transport` is only half a selector today: `makeSendEmail` falls through from
 * an explicitly-injected SES client, to `console`, to SendGrid if an API key
 * happens to be set, to SES. Making the choice explicit — and replacing the
 * `console` transport with SMTP against a local mail catcher — is left to the
 * change that adds an SMTP transport, so this module only moves the reads.
 */
export default {
  /** Derived on access so `env.set('EMAIL_TRANSPORT', …)` is respected. */
  get transport() {
    return env.get('EMAIL_TRANSPORT');
  },

  /** Only consulted when no SES client is injected and `transport` is unset. */
  get sendgridApiKey() {
    return env.get('SENDGRID_API_KEY');
  },

  /** The addresses Coop sends as. */
  addresses: {
    get noReply() {
      return env.get('NOREPLY_EMAIL', 'noreply@example.com');
    },
    get support() {
      return env.get('SUPPORT_EMAIL', 'support@example.com');
    },
    get team() {
      return env.get('TEAM_EMAIL', 'team@example.com');
    },
  },
};
