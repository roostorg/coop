// NB: this doesn't support comma separated lists, because that's hard to
// express in TS. Even with template string types, you end up with circularity
// errors rn (unless you use conditional types to delay evaluation, but that
// leads to weird ergonomics for users of the type). It also doesn't validate
// the numbers, as that'd make a union type that's too big for TS to handle.
// We can't even validate the month actually, as that makes the union too big :(
import { ChartProps } from 'cdk8s';

// prettier-ignore
export type SimpleCronSpec =
  `${CronValue} ${CronValue} ${CronValue} ${CronValue<number | string>} ${CronValue<number | DayOfWeek>}`;

type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
type CronValue<RangeValue extends string | number = number> =
  | `*`
  | `${RangeValue}`
  | `${RangeValue}-${RangeValue}`;

export type NumberRange<
  Max extends number,
  Min extends number = 0,
> = RangeArray<Max> extends readonly any[]
  ? RangeArray<Min> extends readonly any[]
    ? Exclude<RangeArray<Max>[number], RangeArray<Min>[number]>
    : never
  : never;

type RangeArray<
  Max extends number,
  Result extends any[] = [],
> = Result['length'] extends Max
  ? Result
  : RangeArray<Max, [...Result, Result['length']]>;

export type NamespacedChartProps = ChartProps &
  Required<Pick<ChartProps, 'namespace'>>;

export type NonEmptyArray<T> = [T, ...T[]];
