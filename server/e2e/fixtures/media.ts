/**
 * Media URLs for e2e tests. The server's item-field validator only accepts
 * http(s) URLs (no data URIs), and the audio/video must actually load to be
 * played, so we serve tiny fixtures from the client dev server's `public/` dir
 * (localhost is allowed via ALLOW_USER_INPUT_LOCALHOST_URIS=true). The image
 * reuses the existing client logo.
 */

const mediaBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export const IMAGE_URL = `${mediaBaseUrl}/logo192.png`;

export const AUDIO_URL = `${mediaBaseUrl}/e2e/tone-3s.wav`;

export const VIDEO_URL = `${mediaBaseUrl}/e2e/test-video-2s.mp4`;
