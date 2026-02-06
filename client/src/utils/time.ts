import { DateString } from '@roostorg/types';
import moment from 'moment';

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

export function parseDatetimeToReadableStringInUTC(
  date: string | DateString | Date,
): string {
  return moment(date).utc().format('MM/DD/YY hh:mm:ss a');
}

export function parseDatetimeToReadableStringInCurrentTimeZone(
  date: string | DateString | Date,
): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return moment(date).zone(timezone).format('MM/DD/YY hh:mm:ss a');
}

export function parseDatetimeToMonthDayYearDateStringInCurrentTimeZone(
  date: string | DateString | Date,
): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return moment(date).zone(timezone).format('MMM D, YYYY');
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
  // Start and end dates for the graph x axis
  const startDate = moment(start).local();
  const endDate = moment(end).local();

  // Generate an array of dates to be used as a baseline
  // in the case that some date objects have no data
  const datesArray = [];
  const currentDate = startDate.clone();

  while (currentDate.isBefore(endDate)) {
    datesArray.push({
      ds: currentDate.format(
        // format for hour or Day conditionally
        `YYYY-MM-DD${interval === 'HOUR' ? ' HH:mm' : ''}`,
      ),
    } as { [key: string]: any });
    // The above cast is replicating the one done to construct
    // the `formattedData` variable, making typescript
    // happy with the subsequent reduce function typing. God Forgive us.
    const intervalToMomentDurationString = {
      HOUR: 'hours',
      DAY: 'days',
    } as const;

    currentDate.add(1, intervalToMomentDurationString[interval]);
  }

  return datesArray;
}
