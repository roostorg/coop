import { ProxyTracerProvider } from '@opentelemetry/api';

import SafeTracer from './SafeTracer.js';

describe('SafeTracer', () => {
  describe('traced', () => {
    it('shuold run the underlying function with provided args, propagate return value', () => {
      const fn = jest.fn<(it: unknown) => number>().mockReturnValue(1);
      const tracer = new SafeTracer(
        new ProxyTracerProvider().getTracer('noop'),
      );
      const traced = tracer.traced(
        {
          resource: 'test',
          operation: 'something',
          attributesFromArgs(args) {
            // eslint-disable-next-line no-restricted-syntax
            return { it: JSON.stringify(args) };
          },
        },
        fn,
      );

      expect(traced('hello')).toBe(1);
      expect(fn).toHaveBeenCalledWith('hello');
    });
  });
});
