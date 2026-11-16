import { type ReadableStream } from 'node:stream/web';
import { trace } from '@opentelemetry/api';

import { bodyCancellationReason } from './bodyCancellationReason.js';

/**
 * Drop a response body the caller will not finish reading.
 * `cancel()` rejects when the stream is locked by a reader or already errored,
 * and that failure must not hide the error that caused us to abandon it.
 */
export async function cancelReadableStream(
  body: ReadableStream | undefined,
): Promise<void> {
  if (body == null) {
    return;
  }
  try {
    await body.cancel(bodyCancellationReason);
  } catch (error) {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan?.isRecording() && error instanceof Error) {
      activeSpan.recordException(error);
    }
  }
}

/**
 * Stop a media download that a retry is about to replace.
 * Aborting the request closes the socket even when the body stream is locked
 * by an in-progress upload. Cancelling the stream covers the case where the
 * response has already been returned and abort no longer reaches the body.
 */
export async function abandonDownload(
  download: AbortController,
  body: ReadableStream | undefined,
): Promise<void> {
  download.abort(new Error(bodyCancellationReason));
  await cancelReadableStream(body);
}
