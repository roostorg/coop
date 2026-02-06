/* eslint-disable no-console */
import { jsonStringify } from './encoding.js';

// These helpers are only intended to be used when a SafeTracer is not available, e.g. during app startup before it has been initialized

export function logErrorJson(m: { error: unknown; message?: string }) {
  // Serialize error objects properly since they don't have enumerable properties
  const serialized = {
    ...m,
    error: m.error instanceof Error 
      ? { 
          name: m.error.name,
          message: m.error.message, 
          stack: m.error.stack,
          ...(m.error as unknown as Record<string, unknown>)
        }
      : m.error
  };
  console.error(jsonStringify(serialized));
}

export function logJson(message: string) {
  console.log(jsonStringify({ message }));
}
