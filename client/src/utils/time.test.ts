import {
  parseDatetimeToMonthDayYearDateStringInCurrentTimeZone,
  parseDatetimeToReadableStringInCurrentTimeZone,
  parseDatetimeToReadableStringInUTC,
  safeFormat,
  safeFormatDistanceToNow,
} from './time';

describe('Time utils tests', () => {
  describe('safeFormat', () => {
    it('formats a valid date', () => {
      expect(safeFormat('2026-07-15T13:06:00Z', 'yyyy-MM-dd')).toBe(
        '2026-07-15',
      );
    });

    it('formats the epoch instead of treating it as empty', () => {
      expect(safeFormat(new Date(0), 'yyyy')).not.toBe('Unknown');
    });

    it('returns the fallback for an unparseable string without throwing', () => {
      expect(safeFormat('not a date', 'yyyy-MM-dd')).toBe('Unknown');
    });

    it('returns the fallback for null and undefined', () => {
      expect(safeFormat(null, 'yyyy-MM-dd')).toBe('Unknown');
      expect(safeFormat(undefined, 'yyyy-MM-dd')).toBe('Unknown');
    });

    it('honors a custom fallback', () => {
      expect(safeFormat('not a date', 'yyyy-MM-dd', '-')).toBe('-');
    });
  });

  describe('safeFormatDistanceToNow', () => {
    it('returns a relative string for a valid date', () => {
      expect(safeFormatDistanceToNow(new Date())).toContain('ago');
    });

    it('returns the fallback for an unparseable string without throwing', () => {
      expect(safeFormatDistanceToNow('not a date')).toBe('Unknown');
    });

    it('returns the fallback for null', () => {
      expect(safeFormatDistanceToNow(null)).toBe('Unknown');
    });
  });

  describe('parseDatetimeToReadableStringInUTC', () => {
    it('formats a valid date', () => {
      expect(
        parseDatetimeToReadableStringInUTC('2026-07-15T13:06:00Z'),
      ).toMatch(/07\/15\/26/);
    });

    it('returns fallback for an unparseable string', () => {
      expect(parseDatetimeToReadableStringInUTC('not a date')).toBe('Unknown');
    });

    it('returns fallback for null', () => {
      expect(parseDatetimeToReadableStringInUTC(null)).toBe('Unknown');
    });
  });

  describe('parseDatetimeToReadableStringInCurrentTimeZone', () => {
    it('formats a valid date', () => {
      expect(
        parseDatetimeToReadableStringInCurrentTimeZone('2026-07-15T13:06:00Z'),
      ).toMatch(/07\/15\/26/);
    });

    it('returns fallback for an unparseable string', () => {
      expect(parseDatetimeToReadableStringInCurrentTimeZone('not a date')).toBe(
        'Unknown',
      );
    });

    it('returns fallback for null', () => {
      expect(parseDatetimeToReadableStringInCurrentTimeZone(null)).toBe(
        'Unknown',
      );
    });
  });

  describe('parseDatetimeToMonthDayYearDateStringInCurrentTimeZone', () => {
    it('formats a valid date', () => {
      expect(
        parseDatetimeToMonthDayYearDateStringInCurrentTimeZone(
          '2026-07-15T13:06:00Z',
        ),
      ).toMatch(/Jul 15, 2026/);
    });

    it('returns fallback for an unparseable string', () => {
      expect(
        parseDatetimeToMonthDayYearDateStringInCurrentTimeZone('not a date'),
      ).toBe('Unknown');
    });

    it('returns fallback for null', () => {
      expect(parseDatetimeToMonthDayYearDateStringInCurrentTimeZone(null)).toBe(
        'Unknown',
      );
    });
  });
});
