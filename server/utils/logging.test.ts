import { jsonStringify } from './encoding.js';
import { logJson } from './logging.js';

describe('logJson', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves existing single-message output', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    // eslint-disable-next-line no-restricted-syntax -- Exercise the logging helper directly, with no tracer.
    logJson('ready');
    expect(output).toHaveBeenCalledWith(jsonStringify({ message: 'ready' }));
  });

  it('writes scalar structured fields without allowing them to replace the message', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    // eslint-disable-next-line no-restricted-syntax -- Exercise the logging helper directly, with no tracer.
    logJson('ready', {
      event: 'collector.started',
      count: 1,
      enabled: true,
      message: 'ignored',
    });
    expect(output).toHaveBeenCalledWith(
      jsonStringify({
        message: 'ready',
        event: 'collector.started',
        count: 1,
        enabled: true,
      }),
    );
  });
});
