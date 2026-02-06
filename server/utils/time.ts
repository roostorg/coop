import { type Opaque } from 'type-fest';

import { instantiateOpaqueType } from './typescript-types.js';

export const SECOND_MS = 1000;
export const MINUTE_MS = SECOND_MS * 60;
export const HOUR_MS = MINUTE_MS * 60;
export const DAY_MS = HOUR_MS * 24;
export const WEEK_MS = DAY_MS * 7;
export const MONTH_MS = DAY_MS * 30;
export const YEAR_MS = DAY_MS * 365;

// NB: we call this DateOnlyString to avoid a conflict with the DateString type
// in @roostorg/types.
export type DateOnlyString = Opaque<string, 'DateOnlyString'>;

/**
 * Returns a YYYY-MM-DD string for the given Date instance. The date shown in
 * the string represents the date _in UTC time_ of the passed in Date object.
 */
export function getUtcDateOnlyString(date = new Date()) {
  return instantiateOpaqueType<DateOnlyString>(
    date.toISOString().split('T')[0],
  );
}

export function dateWithoutSeconds(date: Date) {
  const res = new Date(date);
  res.setSeconds(0, 0);
  return res;
}

export function getUtcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    date: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
  };
}

export function isValidDate(date: Date) {
  return !isNaN(date.getTime());
}

export function getStartOfDayInTimezone(timezone: string) {
  const dateInTimezone = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone }),
  );
  dateInTimezone.setHours(0, 0, 0, 0);
  return dateInTimezone;
}

export function getEndOfDayInTimezone(timezone: string) {
  const dateInTimezone = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone }),
  );
  dateInTimezone.setHours(23, 59, 59, 999);
  return dateInTimezone;
}
