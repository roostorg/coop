import { type IncomingMessage, type ServerResponse } from 'node:http';
import helmet_, { type HelmetOptions } from 'helmet';

/**
 * `tsc` resolves helmet through the `import` condition to `index.d.mts`, where
 * the default export is callable. `ts-node/esm` — which runs the test suite —
 * lands on the CJS entry instead and sees only the module namespace, so calling
 * the default import compiles but fails at test time with TS2349. Re-export it
 * once with helmet's own documented signature rather than casting per call site.
 *
 * Only reproducible on helmet 8.2.0, which pnpm resolves; npm pins 8.1.0.
 */
export const helmet = helmet_ as unknown as (
  options?: Readonly<HelmetOptions>,
) => (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;
