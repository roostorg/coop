import { safeFormat, safeFormatDistanceToNow } from './time';

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
});
