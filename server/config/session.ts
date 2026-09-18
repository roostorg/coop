import appConfig from '#config/app';
import env from '#start/env';
import type { CookieOptions } from 'express-session';

/**
 * The express-session cookie.
 */
export default {
  secret: env.get('SESSION_SECRET'),

  cookie: {
    /** HTTPS-only outside development, where there is no TLS terminator. */
    secure: appConfig.inProduction,
    httpOnly: true,
    sameSite: 'lax',
    /** 30 days, in milliseconds. */
    maxAge: 30 * 24 * 60 * 60 * 1000,
  } satisfies CookieOptions,
};
