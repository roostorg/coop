/**
 * Many classes in this package allow the user to provide a custom function,
 * which the class will then call when it wants to log a message.
 * This type is the signature for such functions.
 */
export type Logger = (
  component: ComponentName,
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
  message: string,
  data?: unknown,
) => void;

// The ids for the different components in our package that can log.
export type ComponentName = (typeof components)[number];
export const components = [
  "cache",
  "wrap-producer",
  "collapsed-task-creator",
  "redis-store",
] as const;
