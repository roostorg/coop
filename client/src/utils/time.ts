import { DateString } from '@roostorg/types';
import { addDays, addHours, format, isBefore } from 'date-fns';

export enum LookbackLength {
  CUSTOM = 'Custom',
  ONE_DAY = '1D',
  THREE_DAYS = '3D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
}

export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const MONTH = DAY * 30;
export const YEAR = DAY * 365;

/**
 * Transforms a Date object to a string formatted as
 * YYYY-MM-DD
 */
export function formatDate(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function toDate(date: string | DateString | Date): Date {
  return date instanceof Date ? date : new Date(date as string);
}

export function parseDatetimeToReadableStringInUTC(
  date: string | DateString | Date,
): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(',', '');
}

export function parseDatetimeToReadableStringInCurrentTimeZone(
  date: string | DateString | Date,
): string {
  return format(toDate(date), 'MM/dd/yy hh:mm:ss a');
}

export function parseDatetimeToMonthDayYearDateStringInCurrentTimeZone(
  date: string | DateString | Date,
): string {
  return format(toDate(date), 'MMM d, yyyy');
}

export function startOfHourUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function getEarliestDateWithLookback(lookback: LookbackLength): Date {
  const now = Date.now();
  switch (lookback) {
    case LookbackLength.ONE_DAY:
      return new Date(now - DAY);
    case LookbackLength.THREE_DAYS:
      return new Date(now - 3 * DAY);
    case LookbackLength.ONE_WEEK:
      return new Date(now - WEEK);
    case LookbackLength.ONE_MONTH:
      return new Date(now - MONTH);
    case LookbackLength.THREE_MONTHS:
      return new Date(now - 3 * MONTH);
    case LookbackLength.SIX_MONTHS:
      return new Date(now - 6 * MONTH);
    case LookbackLength.ONE_YEAR:
      return new Date(now - YEAR);
    case LookbackLength.CUSTOM:
      return new Date();
  }
}

export function getDateRange(start: Date, end: Date, interval: 'HOUR' | 'DAY') {
  const formatStr = interval === 'HOUR' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd';
  const advanceFn = interval === 'HOUR' ? addHours : addDays;

  const datesArray = [];
  let currentDate = new Date(start);

  while (isBefore(currentDate, end)) {
    datesArray.push({
      ds: format(currentDate, formatStr),
    } as { [key: string]: any });
    currentDate = advanceFn(currentDate, 1);
  }

  return datesArray;
}
