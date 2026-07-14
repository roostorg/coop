// Emit a persistent label on the labeler's own account, for a visual
// subscribe-and-see check in the Bluesky app. Usage: node emit-account-label.mjs [bleep|bloop]
import { AtpAgent } from '@atproto/api';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../ozone/.env', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).split(' #')[0].trim()];
    }),
);
const val = process.argv[2] || 'bleep';

const agent = new AtpAgent({ service: env.SERVICE_PDS_URL || 'https://bsky.social' });
await agent.login({ identifier: env.SERVICE_IDENTIFIER, password: env.SERVICE_APP_PASSWORD });
const { data: auth } = await agent.com.atproto.server.getServiceAuth({
  aud: env.OZONE_SERVER_DID,
  lxm: 'tools.ozone.moderation.emitEvent',
});
const ozone = new AtpAgent({ service: env.OZONE_PUBLIC_URL });
await ozone.tools.ozone.moderation.emitEvent(
  {
    event: {
      $type: 'tools.ozone.moderation.defs#modEventLabel',
      createLabelVals: [val],
      negateLabelVals: [],
    },
    subject: { $type: 'com.atproto.admin.defs#repoRef', did: agent.session.did },
    createdBy: agent.session.did,
  },
  { headers: { authorization: `Bearer ${auth.token}` }, encoding: 'application/json' },
);
console.log(`emitted "${val}" on account ${agent.session.did} (persistent).`);
