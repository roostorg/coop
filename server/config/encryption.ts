import { randomBytes } from 'node:crypto';
import { defineConfig, drivers } from '@adonisjs/core/encryption';

/**
 * AdonisJS' HTTP server needs an encrypter (for signed and encrypted cookies)
 * to boot. Nothing in Coop uses it: sessions stay on express-session, see
 * `app/middleware/session_bridge_middleware.ts`. So rather than add an
 * APP_KEY env var, the key is random per process. Anything that starts using
 * AdonisJS encryption needs a real, shared key first.
 */
export default defineConfig({
  default: 'app',
  list: {
    app: drivers.aes256gcm({
      id: 'app',
      keys: [randomBytes(32).toString('base64url')],
    }),
  },
});
