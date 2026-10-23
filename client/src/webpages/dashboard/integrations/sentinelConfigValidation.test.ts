import { validateSentinelConfig } from './sentinelConfigValidation';

describe('validateSentinelConfig', () => {
  const apiUrl = 'http://sentinel.example.com:8000';

  it('accepts a URL alone', () => {
    expect(validateSentinelConfig({ apiUrl })).toEqual({});
  });

  it('accepts a fully specified config', () => {
    expect(
      validateSentinelConfig({
        apiUrl,
        topK: 5,
        minScoreToConsider: 0.1,
        threadContextWindowMinutes: 30,
        threadContextLimit: 10,
      }),
    ).toEqual({});
  });

  it.each([undefined, '', '   '])('requires a URL (%j)', (value) => {
    expect(validateSentinelConfig({ apiUrl: value })).toHaveProperty('apiUrl');
  });

  it.each(['not a url', 'ftp://sentinel.example.com'])(
    'rejects the URL %j',
    (value) => {
      expect(validateSentinelConfig({ apiUrl: value })).toHaveProperty(
        'apiUrl',
      );
    },
  );

  it.each([
    ['topK', 0],
    ['topK', 1.5],
    ['topK', 'abc'],
    ['minScoreToConsider', 2],
    ['minScoreToConsider', -0.1],
    ['minScoreToConsider', 'abc'],
    ['threadContextWindowMinutes', 0],
    ['threadContextWindowMinutes', -5],
    ['threadContextLimit', 0],
    ['threadContextLimit', 2.5],
    ['threadContextLimit', 101],
  ])('rejects %s = %j', (field, value) => {
    expect(validateSentinelConfig({ apiUrl, [field]: value })).toHaveProperty(
      field,
    );
  });
});
