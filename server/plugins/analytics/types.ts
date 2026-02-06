export interface AnalyticsEventInput {
  /**
   * Row payload associated with the logical analytics table.
   * Keep the shape loose so each adapter can accept arbitrary schemas.
   */
  [key: string]: unknown;
}

export interface AnalyticsQueryResult {
  /** Column/value mapping returned from the analytics store. */
  [column: string]: unknown;
}

export interface AnalyticsWriteOptions {
  /** Override batching behaviour for a specific write. */
  batchTimeout?: number;
}
