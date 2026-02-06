/**
 * This takes a number and reduces it to a human-readable, rounded, abbreviated form.
 * Examples:
 * - 10,125,115,351 -> '10B'
 * - 124,125,351 -> '124M'
 * - 1,725 -> '2K'
 * - 425 -> '425'
 */
export function truncateAndFormatLargeNumber(num: number) {
  const removeTrailingZero = (num: string) => {
    if (num.endsWith('.0')) {
      return num.slice(0, num.length - 2);
    }
    return num;
  };

  if (num >= 1_000_000_000) {
    return removeTrailingZero((num / 1_000_000_000).toFixed(1)) + 'B';
  } else if (num >= 1_000_000) {
    return removeTrailingZero((num / 1_000_000).toFixed(1)) + 'M';
  } else if (num >= 1_000) {
    return removeTrailingZero((num / 1_000).toFixed(1)) + 'K';
  } else {
    return num.toString();
  }
}

export function decimalToPercentage(decimal: number) {
  return `${Math.round(decimal * 100)}%`;
}
