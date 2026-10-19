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

  it('ignores a stream that is already locked or closed', async () => {
    const body = new ReadableStream();
    vi.spyOn(body, 'cancel').mockRejectedValue(new TypeError('locked'));

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
    expect(download.signal.reason).toBe(bodyCancellationReason);
    expect(cancel).toHaveBeenCalledWith(bodyCancellationReason);
  });

  it('still aborts when the body was never received', async () => {
    const download = new AbortController();

    await abandonDownload(download, undefined);

    expect(download.signal.aborted).toBe(true);
  });
});
