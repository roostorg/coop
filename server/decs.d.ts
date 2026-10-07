declare module 'stream-to-blob' {
  export default function streamToBlob(
    stream: NodeJS.ReadableStream,
    mimeType?: string | null,
  ): Promise<Blob>;
}

namespace NodeJS {
  interface ProcessEnv {
    DATABASE_HOST?: string;
    DATABASE_READ_ONLY_HOST?: string;
    DATABASE_PORT?: string;
    DATABASE_NAME?: string;
    DATABASE_USER?: string;
    DATABASE_PASSWORD?: string;
    DATABASE_SSL?: string;
    DATABASE_POOL_MAX?: string;
    DATABASE_READ_POOL_MAX?: string;
    DATABASE_POOL_IDLE_TIMEOUT_MS?: string;
    DATABASE_POOL_CONNECTION_TIMEOUT_MS?: string;
    DATABASE_QUERY_TIMEOUT_MS?: string;
    DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS?: string;
    DATABASE_PRINT_LOGS?: string;
    SESSION_SECRET?: string;
    WAREHOUSE_ADAPTER?: string;
    ANALYTICS_ADAPTER?: string;
    DATA_WAREHOUSE_PROVIDER?: string;
    NCMEC_ENV?: string;
    NCMEC_MESSAGES_URL?: string;
    ENABLE_AGGREGATION_SIGNAL?: string;
    NODE_ENV?: string;
    EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS?: string;
    ALLOW_USER_INPUT_LOCALHOST_URIS?: string;
    REDIS_USE_CLUSTER?: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_USER?: string;
    REDIS_PASSWORD?: string;
    GROQ_SECRET_KEY?: string;
    SENDGRID_API_KEY?: string;
    GOOGLE_PLACES_API_KEY?: string;
    GOOGLE_CONTENT_SAFETY_BASE_URL?: string;
    OPEN_AI_API_KEY?: string;
    OPEN_AI_BASE_URL?: string;
    SLACK_APP_BEARER_TOKEN?: string;
    MANUAL_REVIEW_LOCK_DURATION_MS?: string;
  }
}
