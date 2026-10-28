# API Keys & Authentication

## Sending requests to Coop

To authenticate the requests you send to Coop, add an HTTP header to every API request with one of your organization's API keys. Administrators can create named keys and manage them in **Settings** → **API Keys** in the Coop UI. Use a separate key for each integration.

Format the header as follows:

```
X-API-KEY: <<apiKey>>
Content-Type: application/json
```

You can rotate individual API keys at any time from the same page.

### Permissions

New keys have no permissions by default. Select only the permissions an integration needs. Read and write are independent: neither grants the other. To change permissions, revoke the key and create a replacement.

All REST paths below use the `/api/v1` prefix.

| Permission        | Access                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `items:read`      | GET `/user_scores` and derived data requested through `/content`                                  |
| `items:write`     | POST `/items/async` and POST `/content`                                                           |
| `reports:write`   | POST `/report`                                                                                    |
| `appeals:write`   | POST `/report/appeal`                                                                             |
| `actions:execute` | POST `/actions`                                                                                   |
| `config:read`     | GET `/actions`, `/item_types`, and `/policies`                                                    |
| `config:write`    | Reserved for creating or updating configuration; no REST routes currently consume this permission |

POST `/content` with `includeDerivedField` requires both `items:write` and `items:read`. Submitting reports and appeals requires only the corresponding permission, including any items submitted as part of that workflow. Missing or revoked keys receive HTTP 401; valid keys without the required permissions receive HTTP 403.

### Deployment and rollback

Apply the additive API key permissions migration before deploying the application. Its backfill and database default are the fixed list `items:read`, `items:write`, `reports:write`, `appeals:write`, `actions:execute`, and `config:read`. They exclude `config:write` and do not expand when more permissions are added. The default supports inserts from application instances that omit the column; the application explicitly stores an empty list for new keys unless grants are selected.

Complete the application rollout before issuing restricted keys: instances without permission enforcement cannot honor their restrictions. Rollback retains the `permissions` column and its data. Keep permission enforcement wherever configuration-write endpoints are exposed; do not roll back to an application that exposes those endpoints without checking `config:write`. Shared-environment migrations require separate maintainer authorization.

## Verifying incoming requests from Coop

To verify that an incoming request to your Action APIs (or other webhooks) was sent by Coop, you can check the request signature. Coop signs each HTTP request it sends to your endpoints and includes the signature in a header. You use a **webhook signature verification key** (public key) to verify that signature.

- Your **webhook signature verification key** is shown in **Settings** → **API Keys** under "Webhook Signature Verification Key". You can generate a new key there when needed; after rotation, update your verification logic with the new public key.

### Validating requests with the signature header

Coop sends the signature in a `Coop-Signature` header (or `coop-signature` depending on the client). To validate an incoming HTTP request:

1. **Hash the request body** using SHA-256. Use the raw request body (binary) as the input to the hash.
2. **Base64-decode** the value in the `Coop-Signature` header to obtain the raw binary signature.
3. **Verify the signature** using your public key. Coop uses **RSASSA-PKCS1-v1_5** with **SHA-256**: decrypt/verify the signature with your public key and confirm it matches the hash from step 1. Use your language’s crypto library (e.g. Web Crypto, OpenSSL, or standard crypto packages) for RSASSA-PKCS1-v1_5 verification.

### Example (JavaScript / Node)

```javascript
// Your public signing key in PEM format (from Settings → API Keys)
const pem = `-----BEGIN PUBLIC KEY-----
...your key...
-----END PUBLIC KEY-----`;

const pemHeader = '-----BEGIN PUBLIC KEY-----';
const pemFooter = '-----END PUBLIC KEY-----';
const publicKeyPem = pem.substring(
  pemHeader.length,
  pem.length - pemFooter.length,
);

const publicKeyBuffer = Buffer.from(publicKeyPem, 'base64');
const requestBodyBuffer = Buffer.from(req.body, 'utf8');
const signature = Buffer.from(req.headers['coop-signature'], 'base64');

const publicKey = await crypto.subtle.importKey(
  'spki',
  publicKeyBuffer,
  { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
  false,
  ['verify'],
);

const isValid = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5',
  publicKey,
  signature,
  requestBodyBuffer,
);
```

Adjust header name (`coop-signature` vs `Coop-Signature`) and body encoding to match how your server receives the request.
