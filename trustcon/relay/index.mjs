// TrustCon workshop label relay.
// Receives a Coop CUSTOM_ACTION webhook when a reviewer makes a decision, and emits
// a benign Bleep/Bloop label on the reviewed Bluesky post via the workshop Ozone labeler.
// It also keeps the last few calls in memory so the Codespace has an in-console
// confirmation for anyone not watching Bluesky directly.
import http from 'node:http';
import { AtpAgent } from '@atproto/api';

const {
  PORT = '8090',
  OZONE_URL, // https URL of the Ozone service (used by admins/UI; agent proxies here)
  OZONE_SERVER_DID, // did:plc:... of the labeler service account
  ADMIN_PDS_URL = 'https://bsky.social',
  ADMIN_IDENTIFIER, // labeler admin account handle or DID
  ADMIN_APP_PASSWORD, // app password for that account
  ADMIN_DID, // did used as createdBy; must be listed in OZONE_ADMIN_DIDS
  ALLOWED_LABELS = 'bleep,bloop', // guardrail: only these values may ever be emitted
  APPVIEW_URL = 'https://public.api.bsky.app',
} = process.env;

const allowed = new Set(
  ALLOWED_LABELS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const recent = [];
function record(entry) {
  const row = { at: new Date().toISOString(), ...entry };
  recent.unshift(row);
  if (recent.length > 50) recent.length = 50;
  console.log(JSON.stringify(row));
}

// Resolve the post's current CID so the label targets the specific record (strong ref)
// rather than the whole account. Public AppView call, no auth needed.
async function resolveCid(atUri) {
  const url = `${APPVIEW_URL}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getPosts returned ${res.status}`);
  const data = await res.json();
  const cid = data?.posts?.[0]?.cid;
  if (!cid) throw new Error('post not found on AppView, or it has no cid');
  return cid;
}

let agentPromise;
async function getOzoneAgent() {
  // VERIFY-AT-DEPLOY: exact login/proxy wiring depends on your Ozone deployment.
  // Standard pattern: log in at the PDS, then proxy tools.ozone.* to the labeler service.
  if (!agentPromise) {
    agentPromise = (async () => {
      const agent = new AtpAgent({ service: ADMIN_PDS_URL });
      await agent.login({
        identifier: ADMIN_IDENTIFIER,
        password: ADMIN_APP_PASSWORD,
      });
      return agent.withProxy('atproto_labeler', OZONE_SERVER_DID);
    })();
  }
  return agentPromise;
}

async function emitLabel({ uri, cid, val }) {
  const agent = await getOzoneAgent();
  await agent.tools.ozone.moderation.emitEvent({
    event: {
      $type: 'tools.ozone.moderation.defs#modEventLabel',
      createLabelVals: [val],
      negateLabelVals: [],
    },
    subject: { $type: 'com.atproto.repo.strongRef', uri, cid },
    createdBy: ADMIN_DID,
  });
}

function renderPage() {
  const rows = recent
    .map((r) => {
      const status = r.ok ? 'ok' : 'error';
      const detail = r.ok ? `${r.val} on ${r.uri}` : r.error;
      return `<tr><td>${r.at}</td><td class="${status}">${status}</td><td>${detail || ''}</td><td>${r.actor || ''}</td></tr>`;
    })
    .join('');
  return `<!doctype html><meta charset="utf-8"><title>TrustCon label relay</title>
<style>body{font:14px system-ui;margin:40px;color:#16201d}h1{font-size:18px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #dce2df;padding:6px 10px;text-align:left}
.ok{color:#0e6b5a}.error{color:#b8420c}</style>
<h1>TrustCon label relay</h1>
<p>Last ${recent.length} action(s) received from Coop. Allowed labels: ${[...allowed].join(', ')}.</p>
<table><tr><th>time</th><th>status</th><th>detail</th><th>reviewer</th></tr>${rows}</table>`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderPage());
    return;
  }
  if (req.method === 'POST' && req.url === '/label') {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', async () => {
      try {
        // Coop signs the body with the org key in the `coop-signature` header.
        // Verification is optional for the workshop; add it here if you want it.
        const body = JSON.parse(raw);
        const uri = body?.item?.id;
        const val = body?.custom?.labelVal;
        if (!uri || !uri.startsWith('at://'))
          throw new Error('item.id is not an at:// uri');
        if (!allowed.has(val))
          throw new Error(`label "${val}" is not in the allow list`);
        const cid = await resolveCid(uri);
        await emitLabel({ uri, cid, val });
        record({ ok: true, uri, val, actor: body?.actorEmail });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, uri, cid, val }));
      } catch (e) {
        record({ ok: false, error: String(e?.message || e) });
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

for (const [k, v] of Object.entries({
  OZONE_SERVER_DID,
  ADMIN_IDENTIFIER,
  ADMIN_APP_PASSWORD,
  ADMIN_DID,
})) {
  if (!v)
    console.warn(
      `warning: ${k} is not set; label emission will fail until it is`,
    );
}

server.listen(Number(PORT), () =>
  console.log(`label relay listening on :${PORT}`),
);
