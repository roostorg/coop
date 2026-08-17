export interface ClickhouseActionExecutionRow {
  ts: string;
  item_id: string | null;
  item_type_id: string | null;
  item_type_kind: string;
  item_creator_id: string | null;
  item_creator_type_id: string | null;
  actor_id: string | null;
  job_id: string | null;
  policies?: string | null;
  rules?: string | null;
  action_id: string;
  action_source?: string;
}

export interface ClickhouseModeratorActionGroupRow {
  correlation_id: string;
  last_ts: string;
  actor_id: string | null;
  item_type_id: string | null;
  actor_note: string | null;
  policies?: string | null;
  action_ids: string[] | null;
  // ClickHouse returns UInt64 aggregates as strings over the JSON interface.
  item_count: string | number;
  failed_count: string | number;
}

export interface ClickhouseManualActionItemRow {
  item_id: string;
  item_type_id: string | null;
  failed: string | number;
  total_count: string | number;
}
