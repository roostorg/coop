import { unwrapResolverError } from '@apollo/server/errors';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';

import { ErrorType, sanitizeError } from '../../utils/errors.js';

// Shared with Apollo tests so sanitization is tested at the client boundary.
export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const rawError = unwrapResolverError(error);
  if (rawError instanceof GraphQLError) return formattedError;

  const sanitizedError = sanitizeError(
    rawError instanceof Error ? rawError : error,
  );
  const { title: sanitizedErrorTitle, ...extensions } = sanitizedError;
  return {
    locations: formattedError.locations,
    path: formattedError.path,
    extensions: {
      ...extensions,
      code: extensions.type.includes(ErrorType.Unauthenticated)
        ? 'UNAUTHENTICATED'
        : extensions.type.includes(ErrorType.Unauthorized)
          ? 'FORBIDDEN'
          : extensions.type.includes(ErrorType.InvalidUserInput)
            ? 'BAD_USER_INPUT'
            : 'INTERNAL_SERVER_ERROR',
    },
    message: sanitizedErrorTitle,
  };
}
