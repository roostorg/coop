import {
  formatReportClient,
  formatReportContext,
  reportContextEntries,
} from './reportContext';

describe('formatReportClient', () => {
  it('formats name, version and platform, omitting missing parts', () => {
    expect(
      formatReportClient({ name: 'Ivory', version: '2.3.1', platform: 'ios' }),
    ).toBe('Ivory 2.3.1 (ios)');
    expect(formatReportClient({ name: 'Ivory', version: null })).toBe('Ivory');
    expect(formatReportClient({ platform: 'android' })).toBe('(android)');
  });

  it('returns undefined when there is nothing to show', () => {
    expect(formatReportClient(null)).toBeUndefined();
    expect(formatReportClient({ name: null })).toBeUndefined();
  });
});

describe('reportContextEntries', () => {
  it('orders surface, client, then attributes sorted by key', () => {
    expect(
      reportContextEntries({
        surface: 'feed',
        client: { name: 'Ivory' },
        attributes: { zeta: 1, alpha: true, skipped: null },
      }),
    ).toEqual([
      { label: 'Surface', value: 'feed' },
      { label: 'Client', value: 'Ivory' },
      { label: 'alpha', value: 'true' },
      { label: 'zeta', value: '1' },
    ]);
  });

  it('returns no entries for missing context', () => {
    expect(reportContextEntries(undefined)).toEqual([]);
    expect(reportContextEntries({ attributes: {} })).toEqual([]);
  });
});

describe('formatReportContext', () => {
  it('joins entries into a single line', () => {
    expect(
      formatReportContext({ surface: 'post', attributes: { arm: 'b' } }),
    ).toBe('Surface: post · arm: b');
  });

  it('returns undefined for empty context', () => {
    expect(formatReportContext(null)).toBeUndefined();
  });
});
