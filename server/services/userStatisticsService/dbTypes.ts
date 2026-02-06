// Types for tables in the user stats service's schema.
// THESE SHOULD NOT BE USED OUTSIDE OF THIS SERVICE.

export type UserStatisticsServiceSnowflake = {
  'USER_STATISTICS_SERVICE.SUBMISSION_STATS': SubmissionStats;
  'USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS': LifetimeActionStats;
  'USER_STATISTICS_SERVICE.USER_SCORES': UserScores;
};

export type UserStatisticsServicePg = {
  'user_statistics_service.user_scores': {
    org_id: string;
    user_id: string;
    user_type_id: string;
    score: number;
  };
};

export type LifetimeActionStats = {
  ORG_ID: string;
  USER_ID: string;
  USER_TYPE_ID: string;
  ACTION_ID: string;
  POLICY_ID: string | null;
  ACTOR_ID: string | null;
  ITEM_SUBMISSION_IDS: string[];
  // TODO: technically count is nullable in the db (it's just never null);
  // we should migrate the db.
  COUNT: number;
};

export type SubmissionStats = {
  ORG_ID: string;
  USER_ID: string;
  // This is the item type of the user in question
  USER_TYPE_ID: string;
  // This is the item type that the user has submitted
  ITEM_TYPE_ID: string;
  NUM_SUBMISSIONS: string;
  // NB: these are actually "SnowflakeDate" instances. SnowflakeDate is a
  // custom class from the Snowflake driver that roughly extends Date, but
  // adds a custom toString() that changes (breaks) the date's default JSON
  // representation.
  // TODO: convert these globally to Dates at the Kysely level, so we don't
  // have to deal with this nonsense in our code.
  TS_START_INCLUSIVE: Date;
  TS_END_EXCLUSIVE: Date;
};

export type UserScores = {
  ORG_ID: string;
  USER_ID: string;
  USER_TYPE_ID: string;
  SCORE: number;
  SCORE_DATE: Date;
};
