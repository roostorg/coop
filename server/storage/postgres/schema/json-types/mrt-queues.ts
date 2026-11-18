// Narrowed column types for manual_review_tool queue tables, attached to the
// model with `.$type<...>()`. These mirror the CHECK constraints on
// manual_review_queues and the service types of the same names.

export type JobSortType = 'FIFO' | 'NUM_REPORTS' | 'WEIGHTED';

export type ClearReportsDisposition =
  'AUTOMATIC_CLOSE' | 'IGNORE' | 'SAME_ACTION';

export type ClearReportsScope = 'CURRENT_QUEUE' | 'ALL_QUEUES';
