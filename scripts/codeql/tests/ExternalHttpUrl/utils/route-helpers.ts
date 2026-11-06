import type { RequestHandler } from 'express';

import type { FetchHTTP } from '../services/networkingService/index.js';

export const route = {
  post(
    path: string,
    handler: (dependencies: { fetchHTTP: FetchHTTP }) => RequestHandler[],
  ) {
    return { method: 'post' as const, path, handler };
  },
};
