// Declares the workshop labeler and its two benign label values (bleep, bloop).
// Run once, after the labeler service account exists and before the workshop.
// Writes the app.bsky.labeler.service `self` record on the service account's repo.
import { AtpAgent } from '@atproto/api';

const {
  SERVICE_PDS_URL = 'https://bsky.social',
  SERVICE_IDENTIFIER, // labeler service account handle or DID
  SERVICE_APP_PASSWORD, // app password for that account
} = process.env;

if (!SERVICE_IDENTIFIER || !SERVICE_APP_PASSWORD) {
  console.error('set SERVICE_IDENTIFIER and SERVICE_APP_PASSWORD');
  process.exit(1);
}

const agent = new AtpAgent({ service: SERVICE_PDS_URL });
await agent.login({
  identifier: SERVICE_IDENTIFIER,
  password: SERVICE_APP_PASSWORD,
});

const def = (identifier, name) => ({
  identifier, // lowercase ascii + hyphen only
  severity: 'inform', // neutral, informational
  blurs: 'none', // hides nothing
  defaultSetting: 'warn',
  adultOnly: false,
  locales: [
    {
      lang: 'en',
      name,
      description:
        'A benign demo label applied during the ROOST TrustCon workshop. It carries no ' +
        'judgment and exists only to show a real label reaching Bluesky.',
    },
  ],
});

await agent.com.atproto.repo.putRecord({
  repo: agent.session.did,
  collection: 'app.bsky.labeler.service',
  rkey: 'self',
  record: {
    $type: 'app.bsky.labeler.service',
    createdAt: new Date().toISOString(),
    policies: {
      labelValues: ['bleep', 'bloop'],
      labelValueDefinitions: [def('bleep', 'Bleep'), def('bloop', 'Bloop')],
    },
  },
});

console.log('published app.bsky.labeler.service for', agent.session.did);
