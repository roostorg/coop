import { type DateOnlyString } from '../../utils/time.js';

/** Warehouse driver date (opaque `Date` for Kysely columns). */
export type SfDate = Omit<Date, 'toJSON'>;

/** Date column value or date-only string for filters. */
export type FilterableSfDate = SfDate | DateOnlyString;
