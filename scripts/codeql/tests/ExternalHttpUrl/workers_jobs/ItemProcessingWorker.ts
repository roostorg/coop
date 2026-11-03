import { Worker } from 'bullmq';

import type { FetchHTTP } from '../services/networkingService/index.js';

declare const client: FetchHTTP;
new Worker('item-submissions', async (job) => {
  const media = job.data;
  await client({
    url: media.url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
});
