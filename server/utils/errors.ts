/* eslint-disable import/no-restricted-paths */
// Normally, code outside the graphql folder (which should only hold
// GQL-specific code) shouldn't import from the GQL folder. However, the
// IntegrationApi, OrgApi, and UserApi are currently implemented inside the GQL
// folder (even though the logic in them really ought to be in a
// transport-agnostic service in the services folder), so, for now, this file
// has to import just those files from the graphql folder.
import { type IntegrationErrorType } from '../graphql/datasources/IntegrationApi.js';
import { type OrgErrorType } from '../graphql/datasources/OrgApi.js';
import {
  type SignUpErrorType,
  type UserErrorType,
} from '../graphql/datasources/UserApi.js';
/* eslint-enable import/no-restricted-paths */
import { type ManualReviewToolServiceErrorType } from '../services/manualReviewToolService/index.js';
import { type ModerationConfigErrorType } from '../services/moderationConfigService/index.js';
import { type PartialItemsServiceErrorType } from '../services/partialItemsService/index.js';
import { type ReportingServiceErrorType } from '../services/reportingService/index.js';
import { filterNullOrUndefined } from './collections.js';
import { safePick } from './misc.js';

// Keep a master list of our error types, for convenience. These are types
// for our exposed errors, which are sent in both REST and GraphQL responses.
// The types are root-relative URLs usable by clients for classifying this error.
// This list is gonna get huge, but we'll figure out how to break it up later;
// for now, we'll group some errors by model, and put generic ones at the end.
export enum ErrorType {
  // Content Type/Content Submission Errors
  UnrecognizedContentType = '/errors/unrecognized-content-type',
  ContentInvalidForContentType = '/errors/content-invalid-for-content-type',

  // To replace the above once we migrate the submission endpoint
  DataInvalidForItemType = '/errors/data-invalid-for-item-type',
  FieldRolesInvalidForItemType = '/errors/field-roles-invalid-for-item-type',
  AttemptingToDeleteDefaultUserType = 'errors/attempting-to-delete-default-user-type',

  // Rule + Rule evaluation Errors
  AttemptingToMutateActiveRule = '/errors/attempting-to-mutate-active-rule',
  InvalidMatchingValues = '/errors/invalid-matching-values',
  PermanentSignalError = '/errors/permanent-signal-error',

  // Signing Key Pair Errors
  SigningKeyPairAlreadyExists = '/errors/signing-key-pair-already-exists',
  SigningKeyPairNotFound = '/errors/signing-key-pair-not-found',

  NotFound = '/errors/not-found',
  InvalidUserInput = '/errors/invalid-user-input',

  // Conflict is for any time the resource is in a state that makes it unable to
  // process the request. UniqueViolation and ConcurrencyConflict are specific
  // types of conflicts.
  Conflict = '/errors/conflict',
  UniqueViolation = '/errors/unique-violation',
  ConcurrencyConflict = '/errors/concurrent-update-conflict',

  InternalServerError = '/errors/internal-server-error',

  // authz
  Unauthenticated = '/errors/authentication-failed-or-missing',
  Unauthorized = '/errors/authorization-failed',
}

// A key that can be added to any SerializableError error object to indicate
// that the error is safe to send to the client as-is (i.e., that it doesn't
// contain any sensitive implementation info that needs to be removed first for
// security). CoopError instances are marked as safe by default (since their
// message is populated manually, rather than coming from any libraries we're calling.)
const safeErrorKey = Symbol();

export type SafeErrorKey = typeof safeErrorKey;

// Derived from https://jsonapi.org/format/1.1/#error-objects, with some changes.
// Provides a uniform set of properties for all the errors we serialize, whether
// via GraphQL or traditional HTTP.
export type SerializableError = {
  status: number;
  type: ErrorType[];
  // A short, human-readable summary of the problem that SHOULD NOT change
  // from occurrence to occurrence of the problem, except for localization.
  title: string;

  // A pointer to the input data that is the primary source of the problem.
  // This is a JSON pointer. On HTTP requests, it's a pointer into the request
  // body. For GraphQL, it's a pointer into an object formed by wrapping up all
  // the arguments (keyed by argument name). For example, if we have
  // `input CreateXInput { name: String! }`, and a mutation like:
  // `createX(input: CreateXInput!): X`, and the name is the issue, then the
  // pointer would be `/input/name`.
  pointer?: string;

  // A human-readable explanation specific to this occurrence of the problem.
  detail?: string;
  // The id of the request that caused the error. It might be useful to surface
  // this to users, so they can tell it to us if we're helping them debug a
  // failure.
  requestId?: string;

  [safeErrorKey]?: true;
};

// The props that vary per error instance (from HttpError + cause).
export type ErrorInstanceData = Omit<
  SerializableError,
  'status' | 'title' | 'type'
> & {
  cause?: unknown;
  type?: ErrorType[];
  shouldErrorSpan: boolean;
};

/**
 * A class that represents errors that have a standard set of fields and that
 * are considered safe to expose to end users (i.e., because their fields don't
 * contain implementation details that we'd like to keep private).
 *
 * This class is called CoopError because it should be used for errors
 * created directly from our code, which we know can be safely serialized,
 * unlike errors thrown by our dependencies/third-party libraries, which could
 * have secret details in them.
 *
 * NB: DO NOT SUBCLASS THIS. Instead, create a function that returns a
 * CoopError instance, with a more specific `name` property (if needed).
 * The reason for this is that our sanitizeError must be able to produce a
 * sanitized error that has the `cause` field removed (or, in the future,
 * possibly recursively sanitized instead). To remove `cause`, without mutating
 * the error in place, `sanitizeError` needs to clone the original error. If the
 * error were a CoopError subclass, then there'd be no generic way to clone
 * it that wouldn't break the prototype chain (i.e., the clone would no longer
 * pass as an `instanceof CoopErrorSubclass` check). A simple clone approach
 * w/ object spread would lose even the Error/CoopError parts of the chain,
 * while a `CoopError.clone` method in the base class still wouldn't work,
 * as it wouldn't know the signature of the child class's constructor, so it
 * couldn't construct a subclass instance (plus, even if we defined a signature
 * as part of the informal contract, TS wouldn't type check that). Therefore,
 * we'd have to define a `clone` method in each child class, which ends up with
 * _a lot_ of boilerplate, and some potential bugs.
 *
 * By not extending CoopError, and instead representing the "subclass" as
 * just a `name` field (using a string union literal type to prevent typos,
 * because NAME IS SERIALIZED/PUBLIC), we can avoid all this nonsense about
 * preserving class identity (and the risk of a subclass overriding some
 * parent-class-relevant behavior), which is a perfect example of why dynamic
 * languages w/ structural typing of dictionary-like plain data can be so nice.
 * Unfortunately, we can't take this structural approach all the way to its
 * logical conclusion, because we do want to have our errors ultimately be
 * instances of the built-in `Error` class, and having one class level below
 * that lets us enforce some nice things (e.g., the `new.target` check below.)
 * But, besides that, we want no subclassing.
 */
export class CoopError<Name extends CoopErrorName = CoopErrorName>
  extends Error
  implements SerializableError
{
  public readonly status: number;
  public readonly type: ErrorType[];
  public readonly title: string;
  public override readonly name: Name;
  public readonly [safeErrorKey] = true;
  // This is used to indicate whether or not we want this error to be considered
  // an error in the corresponding OTel span generated by SafeTracer.
  public readonly shouldErrorSpan: boolean;

  public readonly pointer?: string = undefined;
  public readonly detail?: string = undefined;
  public readonly requestId?: string = undefined;

  constructor(
    data: SerializableError & {
      cause?: unknown;
      name: Name;
      shouldErrorSpan: boolean;
    },
  ) {
    if (new.target !== CoopError) {
      throw new Error(
        'Cannot subclass CoopError. See comment above this class.',
      );
    }

    const {
      cause,
      title,
      status,
      type,
      detail,
      name,
      shouldErrorSpan,
      ...errDataRest
    } = data;

    super(title + (detail ? ` ${detail}` : ''), { cause });

    this.status = status;
    this.type = type;
    this.title = title;
    this.name = name;
    this.detail = detail;
    this.shouldErrorSpan = shouldErrorSpan;

    Object.assign(this, errDataRest);
    Error.captureStackTrace(this, CoopError);
  }

  clone() {
    return this.cloneWith({});
  }

  cloneWith(overrides: Partial<ErrorInstanceData>): CoopError<Name> {
    return new CoopError({
      ...this,
      type: [...this.type],
      // copy `cause` explicitly since it's not enumerable
      // (i.e., won't be picked up by `...this`)
      cause: this.cause,
      ...overrides,
    });
  }

  /**
   * Customize the JSON serialization, mostly to exclude `name` (which hasn't
   * been returned historically in REST responses [though GQL has exposed it]
   * and needn't be part of that contract -- that's what type is for), but also
   * to hide `cause` and any other properties that might be added unintentionally.
   */
  toJSON(): SerializableError {
    return safePick(this, [
      'status',
      'type',
      'title',
      'pointer',
      'detail',
      'requestId',
    ]);
  }
}

// List of all our coop errors.
//
// NB: these names are serialized in GQL as the __typename, and in HTTP
// responses, so DON'T CHANGE THEM lightly.
//
// TODO: figure out some system for when to add a CoopErrorName vs. a new
// ErrorType value.
export type CoopErrorName =
  // fallback/default name
  | 'CoopError'
  // rule engine errors
  | 'SignalPermanentError'
  | 'DerivedFieldPermanentError'
  // signing key errors
  | 'SigningKeyPairAlreadyExists'
  | 'SigningKeyPairNotFound'
  // errors from different services
  | PartialItemsServiceErrorType
  | ModerationConfigErrorType
  | ManualReviewToolServiceErrorType
  | ReportingServiceErrorType
  // generic errors
  | 'NotFoundError'
  | 'InternalServerError'
  | 'BadRequestError'
  | 'UnauthorizedError'
  // gql mutation errors
  | UserErrorType
  | IntegrationErrorType
  | OrgErrorType
  | SignUpErrorType;

export function isCoopError(it: unknown): it is CoopError {
  return it instanceof CoopError;
}

export function isCoopErrorOfType<T extends CoopErrorName>(
  it: unknown,
  nameOrNames: T | T[],
): it is CoopError<T> {
  return (
    isCoopError(it) &&
    (Array.isArray(nameOrNames)
      ? (nameOrNames satisfies T[] as CoopErrorName[]).includes(it.name)
      : nameOrNames === it.name)
  );
}

// Some generic CoopErrors
export const makeSignalPermanentError = (
  title: string,
  data: ErrorInstanceData,
) =>
  new CoopError({
    ...data,
    status: 500,
    type: [...(data.type ?? []), ErrorType.PermanentSignalError],
    title,
    name: 'SignalPermanentError' as const,
  });

export const makeDerivedFieldPermanentError = (
  title: string,
  data: ErrorInstanceData,
) =>
  new CoopError({
    ...data,
    status: 500,
    type: [...(data.type ?? []), ErrorType.InternalServerError],
    title,
    name: 'DerivedFieldPermanentError',
  });

export const makeNotFoundError = (title: string, data: ErrorInstanceData) =>
  new CoopError({
    ...data,
    status: 404,
    type: [...(data.type ?? []), ErrorType.NotFound],
    title,
    name: 'NotFoundError',
  });

export const makeUnauthorizedError = (title: string, data: ErrorInstanceData) =>
  new CoopError({
    ...data,
    status: 403,
    type: [...(data.type ?? []), ErrorType.Unauthorized],
    title,
    name: 'UnauthorizedError',
  });

export const makeInternalServerError = (
  title: string,
  data: ErrorInstanceData,
) =>
  new CoopError({
    ...data,
    status: 500,
    type: [...(data.type ?? []), ErrorType.InternalServerError],
    title,
    name: 'InternalServerError',
  });

export const makeBadRequestError = (title: string, data: ErrorInstanceData) =>
  new CoopError({
    ...data,
    status: 400,
    type: [...(data.type ?? []), ErrorType.InvalidUserInput],
    title,
    name: 'BadRequestError',
  });

const exposeUnsafeErrorDetails =
  process.env.EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS === 'true';

export const sanitizeError = exposeUnsafeErrorDetails
  ? // In local dev, when exposeUnsafeErrorDetails is true, sanitizeError
    // includes the full error as-is in its result, and just does a minimal
    // transformation, adding some props to satisfy the SerializableError type.
    (err: unknown): SerializableError =>
      typeof err !== 'object'
        ? { title: String(err), status: 500, type: [] }
        : err instanceof CoopError
        ? err
        : { title: String(err), status: 500, type: [], ...err }
  : (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Sanitizing error:', err);
      if (isSafeError(err)) {
        if ((err satisfies object as { cause?: unknown }).cause == null) {
          return err;
        } else {
          const clone = err instanceof CoopError ? err.clone() : { ...err };
          delete (clone satisfies object as { cause?: unknown }).cause;
          return clone;
        }
      } else {
        // eslint-disable-next-line no-console
        console.error('Unknown error:', err);
        return makeInternalServerError('Unknown error', {
          shouldErrorSpan: true,
        });
      }
    };

function isSerializableError(it: unknown): it is SerializableError {
  return Boolean(
    typeof it === 'object' &&
      it &&
      'status' in it &&
      'type' in it &&
      'title' in it,
  );
}

function isSafeError(
  it: unknown,
): it is SerializableError & { [safeErrorKey]: true } {
  return isSerializableError(it) && Boolean(it[safeErrorKey]);
}

export function getMessageFromAggregateError(it: AggregateError): string {
  return filterNullOrUndefined(
    it.errors.map((it) =>
      it instanceof AggregateError
        ? getMessageFromAggregateError(it)
        : it instanceof CoopError
        ? it.title + (it.detail ? `: ${it.detail}` : '')
        : it instanceof Error
        ? it.message
        : undefined,
    ),
  ).join('\n');
}

export function getErrorsFromAggregateError(
  it: AggregateError,
): (Error | CoopError)[] {
  return it.errors.flatMap((it) =>
    it instanceof AggregateError
      ? getErrorsFromAggregateError(it)
      : it instanceof Error
      ? [it]
      : [],
  );
}
