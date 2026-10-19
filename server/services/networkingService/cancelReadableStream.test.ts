import { ReadableStream } from 'node:stream/web';

import { bodyCancellationReason } from './bodyCancellationReason.js';
import {
  abandonDownload,
  cancelReadableStream,
} from './cancelReadableStream.js';

describe('cancelReadableStream', () => {
  it('cancels an unread body with the shared reason', async () => {
    const body = new ReadableStream();
    const cancel = vi.spyOn(body, 'cancel');

    await cancelReadableStream(body);

    expect(cancel).toHaveBeenCalledWith(bodyCancellationReason);
  });

  it('does nothing when the response had no body', async () => {
    await expect(cancelReadableStream(undefined)).resolves.toBeUndefined();
  });

  it('resolves for a stream that is already closed', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    await expect(cancelReadableStream(body)).resolves.toBeUndefined();
  });

  it('ignores a stream that is locked by a reader', async () => {
    const body = new ReadableStream();
    body.getReader();

    await expect(cancelReadableStream(body)).resolves.toBeUndefined();
  });

  it('ignores a stream that has already errored', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error('source failed'));
      },
    });

    await expect(cancelReadableStream(body)).resolves.toBeUndefined();
  });
});

describe('abandonDownload', () => {
  it('aborts the download and cancels the body before a retry', async () => {
    const download = new AbortController();
    const body = new ReadableStream();
    const cancel = vi.spyOn(body, 'cancel');

    await abandonDownload(download, body);

    expect(download.signal.aborted).toBe(true);
    expect(download.signal.reason).toEqual(new Error(bodyCancellationReason));
    expect(cancel).toHaveBeenCalledWith(bodyCancellationReason);
  });

  it('still aborts when the body was never received', async () => {
    const download = new AbortController();

    await abandonDownload(download, undefined);

    expect(download.signal.aborted).toBe(true);
  });
});
