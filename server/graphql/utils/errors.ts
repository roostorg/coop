import { GraphQLError } from 'graphql';

export const unauthenticatedError = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED' } });

export const forbiddenError = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });

export const userInputError = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
