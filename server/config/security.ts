import app from '#config/app';

export default {
  // Production keeps helmet's own defaults, which include a strict
  // Content-Security-Policy. Development relaxes it for Vite's dev server,
  // which needs inline and eval'd scripts plus a websocket for HMR — so these
  // directives must never be the production branch.
  helmet: app.inProduction
    ? {}
    : {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            frameSrc: ["'self'"],
          },
        },
      },
};
