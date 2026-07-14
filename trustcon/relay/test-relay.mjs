// Full relay-path test: create a benign post from the labeler account, POST a
// simulated Coop CUSTOM_ACTION webhook to the running relay, confirm the post
// got a bleep label, then delete the test post.
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
const RELAY = 'http://localhost:8090';
const OZONE = env.OZONE_PUBLIC_URL || 'http://localhost:3001';

const agent = new AtpAgent({ service: env.SERVICE_PDS_URL || 'https://bsky.social' });
await agent.login({ identifier: env.SERVICE_IDENTIFIER, password: env.SERVICE_APP_PASSWORD });

const post = await agent.post({ text: 'TrustCon labeler self-test post (safe to ignore).' });
console.log('created test post:', post.uri);

await new Promise((r) => setTimeout(r, 6000)); // let the AppView index it

const webhook = {
  item: { id: post.uri, typeId: 'ATproto-post', typeName: 'ATproto-post' },
  action: { id: 'test-action' },
  custom: { labelVal: 'bleep' },
  actorEmail: 'reviewer@trustcon.demo',
};
const relayResp = await fetch(`${RELAY}/label`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(webhook),
});
console.log('relay response:', relayResp.status, await relayResp.text());

await new Promise((r) => setTimeout(r, 1500));
const labels = await fetch(
  `${OZONE}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(post.uri)}`,
).then((r) => r.json());
console.log('queryLabels ->', JSON.stringify(labels));

await agent.deletePost(post.uri);
console.log('deleted test post');
