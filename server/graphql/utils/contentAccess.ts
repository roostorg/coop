import { randomUUID } from 'node:crypto';
import { GraphQLError } from 'graphql';

import {
  ContentAccessError,
  type ContentAccessResource,
} from '../../services/contentAccessService.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type Context } from '../resolvers.js';
import { forbiddenError, unauthenticatedError } from './errors.js';

const requests = new WeakMap<
  Context,
  {
    id: string;
    checks: Map<string, Promise<void>>;
  }
>();

/** Await policy and audit before releasing a protected field; aliases share a check. */
export async function beforeContentAccess(
  context: Context,
  resourceOrgId: string,
  resource: ContentAccessResource,
) {
  if (!context.services.ContentAccessService.enabled) return;
  const user = context.getUser();
  if (!user) throw unauthenticatedError('Authenticated user required');
  if (resourceOrgId !== user.orgId) {
    throw forbiddenError('Content belongs to another organization.');
  }
  let request = requests.get(context);
  if (!request) {
    request = { id: randomUUID(), checks: new Map() };
    requests.set(context, request);
  }
  const key = jsonStringify([
    user.id,
    user.orgId,
    resource.resourceType,
    resource.resourceId,
    resource.itemTypeId ?? null,
    resource.submissionId ?? null,
    resource.field,
  ]);
  let check = request.checks.get(key);
  if (!check) {
    check = context.services.ContentAccessService.beforeAccess({
      ...resource,
      actorId: user.id,
      orgId: user.orgId,
      requestId: request.id,
    });
    request.checks.set(key, check);
  }
  try {
    await check;
  } catch (error) {
    if (error instanceof ContentAccessError) {
      if (error.reason === 'denied')
        throw forbiddenError('Content access denied.');
      throw new GraphQLError('Content access verification is unavailable.', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
    throw error;
  }
}
