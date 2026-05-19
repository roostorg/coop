import { summarizeNcmecErrorForReviewer } from './ncmecReviewerErrors.js';

describe('summarizeNcmecErrorForReviewer', () => {
  it('maps 401 from a CyberTip request to an auth message', () => {
    const e = new Error(
      'CyberTip request to /submit failed: status=401, responseCode=1000',
    );
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/Authentication failed/);
  });

  it('maps 403 to the same auth message', () => {
    const e = new Error('CyberTip request to /submit failed: status=403');
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/Authentication failed/);
  });

  it('maps 429 to rate-limited', () => {
    const e = new Error('CyberTip request to /submit failed: status=429');
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/Rate limited/);
  });

  it('maps 504 to timeout', () => {
    const e = new Error('CyberTip request to /submit failed: status=504');
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/timed out/);
  });

  it('maps 5xx to server error', () => {
    const e = new Error('CyberTip request to /submit failed: status=502');
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/server error/i);
  });

  it('maps generic 4xx to rejected', () => {
    const e = new Error('CyberTip request to /submit failed: status=422');
    expect(summarizeNcmecErrorForReviewer(e)).toMatch(/rejected/i);
  });

  it('passes through known reviewer-friendly local errors verbatim', () => {
    expect(
      summarizeNcmecErrorForReviewer(new Error('No media in report')),
    ).toBe('No media in report');
  });

  it('classifies missing-config throws to a config category', () => {
    expect(
      summarizeNcmecErrorForReviewer(
        new Error('NCMEC reports are not enabled for org acme'),
      ),
    ).toMatch(/configuration is incomplete/);
    expect(
      summarizeNcmecErrorForReviewer(new Error('org id not found')),
    ).toMatch(/configuration is incomplete/);
    // 'Insufficient settings' (and any variant with additional detail
    // appended) is routed through CONFIG rather than passed through, so
    // reviewers get the "check Settings → NCMEC" guidance.
    expect(
      summarizeNcmecErrorForReviewer(new Error('Insufficient settings')),
    ).toMatch(/configuration is incomplete/);
    expect(
      summarizeNcmecErrorForReviewer(
        new Error('Insufficient settings: missing username'),
      ),
    ).toMatch(/configuration is incomplete/);
  });

  it('classifies media-assembly throws to a media category', () => {
    expect(
      summarizeNcmecErrorForReviewer(
        new Error('Unable to find reported media in job payload'),
      ),
    ).toMatch(/reported media/);
    expect(
      summarizeNcmecErrorForReviewer(new Error('NCMEC file upload failed.')),
    ).toMatch(/reported media/);
  });

  it('classifies a responseCode-based submission rejection', () => {
    expect(
      summarizeNcmecErrorForReviewer(
        new Error('NCMEC report submission failed: responseCode=4100'),
      ),
    ).toMatch(/rejected/i);
  });

  it('falls back to UNKNOWN for unrecognized text', () => {
    expect(summarizeNcmecErrorForReviewer(new Error('boom'))).toMatch(
      /Unexpected error/,
    );
  });

  it('falls back to UNKNOWN for non-Error, non-string inputs', () => {
    expect(summarizeNcmecErrorForReviewer(undefined)).toMatch(
      /Unexpected error/,
    );
    expect(summarizeNcmecErrorForReviewer({ foo: 'bar' })).toMatch(
      /Unexpected error/,
    );
  });

  it('accepts a raw string as input', () => {
    expect(
      summarizeNcmecErrorForReviewer(
        'CyberTip request to /submit failed: status=401',
      ),
    ).toMatch(/Authentication failed/);
  });
});
