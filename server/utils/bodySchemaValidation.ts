import type { RequestHandler } from 'express';
import type { JsonObject } from 'type-fest';
import {
  safeParse,
  type GenericIssue,
  type GenericSchema,
  type IssuePathItem,
} from 'valibot';

import { makeBadRequestError } from './errors.js';

/**
 * Build an Express middleware that validates `req.body` against `schema`.
 *
 * On failure the middleware forwards a `BadRequestError` (a `CoopError`) to the
 * standard Express error handler, which serializes it into the project's
 * canonical `{ errors: [...] }` shape. The parsed output is intentionally
 * discarded so transformations and object-key handling do not alter the body
 * received by the route handler.
 */
export function createBodySchemaValidator<ReqBody extends JsonObject>(
  schema: GenericSchema<unknown, ReqBody>,
): RequestHandler {
  return (req, _res, next) => {
    const result = safeParse(schema, req.body, { abortEarly: false });
    if (result.success) {
      next();
      return;
    }

    next(
      makeBadRequestError('Request body failed schema validation.', {
        shouldErrorSpan: false,
        pointer: toJsonPointer(result.issues[0].path),
        detail: formatIssues(result.issues),
      }),
    );
  };
}

function toJsonPointer(
  path: readonly IssuePathItem[] | undefined,
): string | undefined {
  if (!path?.length) return undefined;
  return path.map(({ key }) => `/${escapeJsonPointerSegment(key)}`).join('');
}

function escapeJsonPointerSegment(segment: unknown): string {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

function formatIssues(issues: readonly GenericIssue[]): string {
  return issues
    .map((issue) => {
      const loc = toJsonPointer(issue.path) ?? '/';
      return `${loc}: invalid value`;
    })
    .join('; ');
}
