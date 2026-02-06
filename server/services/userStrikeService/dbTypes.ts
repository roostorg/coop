import { type ScyllaRealItemIdentifier } from '../../scylla/index.js';

export type ScyllaTables = {
  user_strikes: ScyllaUserStrikesRow;
};

type ScyllaUserStrikesRow = {
  user_identifier: ScyllaRealItemIdentifier;
  created_at: Date;
  policy_id: string;
  user_strike_count: number;
  org_id: string;
};

export type UserStrikesScyllaRelations = ScyllaTables;
