import {
  normalizeReportContext,
  reportContextToWarehouseColumns,
} from './reportContext.js';

describe('normalizeReportContext', () => {
  it('returns undefined when no context is provided', () => {
    expect(normalizeReportContext(undefined)).toBeUndefined();
    expect(normalizeReportContext({})).toBeUndefined();
  });

  it('returns undefined when every field is null or empty', () => {
    expect(
      normalizeReportContext({
        surface: null,
        client: { name: null, version: '', platform: null },
        attributes: {},
      }),
    ).toBeUndefined();
  });

  it('strips null and empty fields but keeps provided ones', () => {
    expect(
      normalizeReportContext({
        surface: 'profile',
        client: { name: 'Ivory', version: null, platform: 'ios' },
        attributes: { experimentArm: 'b', retried: false },
      }),
    ).toEqual({
      surface: 'profile',
      client: { name: 'Ivory', platform: 'ios' },
      attributes: { experimentArm: 'b', retried: false },
    });
  });
});

describe('reportContextToWarehouseColumns', () => {
  it('writes no columns when there is no context', () => {
    expect(reportContextToWarehouseColumns(undefined)).toEqual({});
  });

  it('maps each field to its column, omitting absent ones', () => {
    expect(
      reportContextToWarehouseColumns({
        surface: 'feed',
        client: { version: '2.3.1' },
        attributes: { sessionId: 'abc' },
      }),
    ).toEqual({
      report_surface: 'feed',
      report_client_version: '2.3.1',
      report_context_attributes: { sessionId: 'abc' },
    });
  });
});
