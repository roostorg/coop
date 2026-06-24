import { Kind, type ValidationContext } from 'graphql';
import depthLimit from 'graphql-depth-limit';

// `graphql-depth-limit@1.1.0` throws when a query references an undefined
// fragment (it dereferences `undefined.kind`). Swallow so other validation
// rules can report the real error instead of crashing the request with a 500.
export function safeDepthLimit(
  maxDepth: number,
  options?: Parameters<typeof depthLimit>[1],
  callback?: Parameters<typeof depthLimit>[2],
) {
  const inner = depthLimit(maxDepth, options, callback);
  return (context: ValidationContext) => {
    try {
      return inner(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(
        '[safeDepthLimit] depth-limit validation crashed; falling back. ' +
          `operations=[${getOperationNames(context).join(',')}] ` +
          `error=${message}`,
      );
      return {};
    }
  };
}

function getOperationNames(context: ValidationContext): string[] {
  const names: string[] = [];
  for (const def of context.getDocument().definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      names.push(def.name?.value ?? '<anonymous>');
    }
  }
  return names;
}
