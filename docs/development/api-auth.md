# API Keys & Authentication

## Sending requests to Coop

To authenticate the requests you send to Coop, add an HTTP header to every API request with one of your organization's API keys. Administrators can create named keys and manage them in **Settings** → **API Keys** in the Coop UI. Use a separate key for each integration.

Format the header as follows:

```
X-API-KEY: <<apiKey>>
Content-Type: application/json
```

Copy each key when you create or rotate it; Coop stores only its hash and cannot display the secret again. The key list shows each key's name, description, status, creation date, and last-used date.

You can rotate or revoke an individual key from the same page without affecting other keys. Rotation replaces that key's secret immediately; update applications that use it. Revocation immediately disables that key and retains its metadata in the list.

For GraphQL integrations, use `apiKeys` to list metadata, `createApiKey` to create a key, and `revokeApiKey(id:)` to revoke one. Supply `input.id` to `rotateApiKey` to rotate a specific active key. Without an ID, `rotateApiKey` targets the most recently created active key, or creates a key if none exists. All key-management operations require the `MANAGE_ORG` user permission.

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
