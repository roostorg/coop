/**
 * Media URLs for e2e tests. The server's item-field validator only accepts
 * http(s) URLs (no data URIs), and the audio must actually load to be played,
 * so we serve a tiny fixture from the client dev server's `public/` dir
 * (localhost is allowed via ALLOW_USER_INPUT_LOCALHOST_URIS=true). The image
 * reuses the existing client logo.
 */

export const IMAGE_URL = 'http://localhost:3000/logo192.png';

export const AUDIO_URL = 'http://localhost:3000/e2e/tone-3s.wav';
