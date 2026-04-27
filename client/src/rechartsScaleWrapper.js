/**
 * Wrapper around recharts-scale that catches [DecimalError] Division by zero.
 * Aliased via craco.config.js so recharts imports this instead of the original.
 */
const actual = require('recharts-scale/es6/getNiceTickValues');

function getNiceTickValues(domain, tickCount, allowDecimals) {
  try {
    return actual.getNiceTickValues(domain, tickCount, allowDecimals);
  } catch (e) {
    if (e.message && e.message.includes('Division by zero')) {
      const min = typeof domain[0] === 'number' ? domain[0] : 0;
      const max = typeof domain[1] === 'number' && domain[1] > min ? domain[1] : min + 1;
      const step = (max - min) / ((tickCount || 5) - 1);
      const ticks = [];
      for (let i = 0; i < (tickCount || 5); i++) {
        ticks.push(min + step * i);
      }
      return ticks;
    }
    throw e;
  }
}

function getTickValuesFixedDomain(domain, tickCount, allowDecimals) {
  try {
    return actual.getTickValuesFixedDomain(domain, tickCount, allowDecimals);
  } catch (e) {
    if (e.message && e.message.includes('Division by zero')) {
      const min = typeof domain[0] === 'number' ? domain[0] : 0;
      const max = typeof domain[1] === 'number' && domain[1] > min ? domain[1] : min + 1;
      const step = (max - min) / ((tickCount || 5) - 1);
      const ticks = [];
      for (let i = 0; i < (tickCount || 5); i++) {
        ticks.push(min + step * i);
      }
      return ticks;
    }
    throw e;
  }
}

exports.getNiceTickValues = getNiceTickValues;
exports.getTickValuesFixedDomain = getTickValuesFixedDomain;
