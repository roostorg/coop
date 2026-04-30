/**
 * Wrapper around `recharts-scale/es6/getNiceTickValues` that recovers from
 * `[DecimalError] Division by zero` errors thrown by upstream when a chart
 * receives a degenerate domain (e.g., all values identical, or non-numeric).
 *
 * Aliased via `resolve.alias` in `client/vite.config.ts`, so any `recharts`
 * import of `recharts-scale/es6/getNiceTickValues` resolves to this module
 * instead of the upstream implementation. We use Vite's alias — not craco —
 * because this app is built with Vite, not Create React App.
 */
const actual = require('recharts-scale/es6/getNiceTickValues');

const DEFAULT_TICK_COUNT = 5;

/**
 * Build a plain linear set of ticks as a last resort when upstream can't
 * compute one. Safe for any `tickCount >= 1` (returns a single tick when
 * `tickCount === 1`, avoiding its own division-by-zero).
 */
function fallbackTicks(domain, tickCount) {
  const count =
    Number.isInteger(tickCount) && tickCount > 0 ? tickCount : DEFAULT_TICK_COUNT;
  const min = typeof domain[0] === 'number' ? domain[0] : 0;
  const max = typeof domain[1] === 'number' && domain[1] > min ? domain[1] : min + 1;
  if (count === 1) return [min];
  const step = (max - min) / (count - 1);
  const ticks = new Array(count);
  for (let i = 0; i < count; i++) {
    ticks[i] = min + step * i;
  }
  return ticks;
}

function isDivisionByZeroError(err) {
  // `recharts-scale` uses `decimal.js` under the hood, which tags the error
  // with `name === 'DecimalError'`. Fall back to a message-substring check
  // for older versions that don't set `name`.
  return (
    (err && err.name === 'DecimalError') ||
    (err && typeof err.message === 'string' && err.message.includes('Division by zero'))
  );
}

function safelyCall(fn, fnName, domain, tickCount, allowDecimals) {
  try {
    return fn(domain, tickCount, allowDecimals);
  } catch (err) {
    if (!isDivisionByZeroError(err)) throw err;
    // eslint-disable-next-line no-console
    console.warn(
      `[rechartsScaleWrapper] ${fnName} threw DecimalError; using linear fallback.`,
      { domain, tickCount },
    );
    return fallbackTicks(domain, tickCount);
  }
}

function getNiceTickValues(domain, tickCount, allowDecimals) {
  return safelyCall(
    actual.getNiceTickValues,
    'getNiceTickValues',
    domain,
    tickCount,
    allowDecimals,
  );
}

function getTickValuesFixedDomain(domain, tickCount, allowDecimals) {
  return safelyCall(
    actual.getTickValuesFixedDomain,
    'getTickValuesFixedDomain',
    domain,
    tickCount,
    allowDecimals,
  );
}

exports.getNiceTickValues = getNiceTickValues;
exports.getTickValuesFixedDomain = getTickValuesFixedDomain;
