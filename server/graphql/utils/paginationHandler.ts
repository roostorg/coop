import { UserInputError } from 'apollo-server-express';
import { type GraphQLFieldResolver as Resolver } from 'graphql';

import { type JSON } from '../../utils/json-schema-types.js';

/**
 * A type describing the arguments a connection field receives in GraphQL.
 */
export type ConnectionArguments<Cursor extends JSON = JSON> = {
  before?: Cursor | null;
  after?: Cursor | null;
  first?: number | null;
  last?: number | null;
};

export type Edge<Node extends object, Cursor extends JSON> = {
  node: Node;
  get cursor(): Cursor;
};

export type Connection<Node extends object, Cursor extends JSON> = {
  pageInfo: {
    startCursor: Cursor;
    endCursor: Cursor;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  edges: Edge<Node, Cursor>[];
};

export type CursorInfo<Cursor extends JSON> = {
  value: Cursor;
  direction: 'before' | 'after';
};

/**
 * Given a function that can get n items from a data source before or after a
 * cursor, returns a resolver for a Connection field in a GraphQL schema.
 * This makes it easy to implement Connections per the Relay Connection spec.
 * See https://relay.dev/graphql/connections.htm
 *
 * We use the Relay Connection spec because it's widely adopted in the GraphQL
 * world, which we might find it convenient for interoperability down the line.
 * Plus, the Relay spec is "good enough", so using it rather than one of the
 * alternatives isn't a big sacrifice.
 *
 * That said, the Relay spec does have a few big inelegancies compared to, e.g.,
 * the cursor-based pagination spec that I wrote for JSON:API (https://jsonapi.org/profiles/ethanresnick/cursor-pagination/).
 * Specifically:
 *
 * 1. It allows the `first` and `last` parameters to be specified together, but
 *    then warns repeatedly that "including a value for both first and last is
 *    strongly discouraged" because, when both are specified, "their meaning as
 *    it relates to pagination becomes unclear". Our implementation below
 *    sidesteps all the issues around combining first and last by just throwing
 *    an error if both are specified. This makes us not 100% spec-compliant, but
 *    in a way that isn't really important in practice.
 *
 *    Our implementation converts the valid combinations of first and last into
 *    a (size: number, takeFrom: 'start' | 'end') pair, which is then easier to
 *    work with. Technically, we could even get by without having `takeFrom` for
 *    now, if we were willing to invent a special "end of collection" cursor
 *    that could serve as the `before` cursor when `last: n` is requested with
 *    no explicit cursor. But that wouldn't be all that much simpler, and it'd
 *    break down if we ever wanted to add support for "range pagination" (i.e.,
 *    using `before` and `after` together), so we stick with `takeFrom`.
 *
 * 2. The Relay spec allows _requires_ that the pageInfo object include non-null
 *    values for both `hasNextPage` and `hasPreviousPage`. However, when the
 *    server can't efficiently determine whether there's a previous or next page,
 *    the Relay spec just allows it to lie to clients and return `false`, even
 *    if their might actually be another page. (My spec essentially returns null,
 *    telling the client "we don't know if there's another page, but you can try
 *    your luck fetching it and see if there is".) Unfortunately, deviating from
 *    the Relay spec here would probably hurt interoperability more than the
 *    deviation above, so we follow the spec and just lie as Relay suggests.
 *    Hopefully, none of our use cases will really care about this, and we could
 *    always add some extra metadata field saying "we just guessed for this
 *    particular hasNextPage/hasPreviousPage value, so don't trust it".
 *
 * 3. The PageInfo object in the relay spec must have a non-nullable
 *    `startCursor` and `endCursor`, but this is impossible to satisfy if the
 *    page is empty (relay assumes it never is, which may be part of why its not
 *    safe for the client to try to fetch an extra page when the server can't
 *    efficiently determine whether one exists). For our implementation, in the
 *    empty page case, we just use the empty object as both the start and the
 *    end cursor, which should be fine, as `hasNextPage` and `hasPreviousPage`
 *    will both be false, so this broken cursor won't be used for anything.
 */
export function makeConnectionResolver<
  Source,
  CursorValue extends JSON,
  Node extends object = object,
  Context = unknown,
  Args extends
    ConnectionArguments<CursorValue> = ConnectionArguments<CursorValue>,
>(
  fetcher: (args: {
    size: number;
    cursor?: CursorInfo<CursorValue>;
    takeFrom: 'start' | 'end';
    source: Source;
    args: Omit<Args, keyof ConnectionArguments>;
    context: Context;
  }) => Promise<{ items: Edge<Node, CursorValue>[] }>,
  maxPageSize: number = Infinity,
  defaultPageSize: number = 50,
) {
  const resolver: Resolver<
    Source,
    Context,
    Args,
    Promise<Connection<Node, CursorValue>>
  > = async (source, args, context, _info) => {
    const { first, last, after, before, ...nonPaginationArgs } = args;

    // To not have to deal with edge cases around using first + last together,
    // which don't enable any useful functionality, we just throw if both are
    // given. Instead, we reconstruct first + last into a `size` and `takeFrom`.
    // TODO: make errors have unique codes. See list of codes here:
    // https://jsonapi.org/profiles/ethanresnick/cursor-pagination/#auto-id-error-cases
    const { takeFrom, pageSize } = (() => {
      if (first != null && last != null) {
        throw new UserInputError(`Cannot specify both first and last`);
      } else if (first != null) {
        return { takeFrom: 'start', pageSize: first } as const;
      } else if (last != null) {
        return { takeFrom: 'end', pageSize: last } as const;
      } else {
        return { takeFrom: 'start', pageSize: defaultPageSize } as const;
      }
    })();

    if (pageSize <= 0) {
      throw new UserInputError('Page size must be a positive number.');
    }

    if (pageSize > maxPageSize) {
      throw new UserInputError(
        `Page size must be less than or equal to ${maxPageSize}.`,
      );
    }

    // Meanwhile, providing both a before and after cursor is also coherent
    // (my cursor pagination spec calls this "range pagination"), but it's not
    // supported for now because we don't need it. We also mention combinations
    // where the user explicitly provided only one cursor, but we synthesized
    // the other.
    if (before != null && after != null) {
      throw new UserInputError('Combining before and after is not supported.');
    }

    // figure out the direction we're paginating in,
    // which defaults to forward pagination (aka, after the cursor).
    const givenCursor = before ?? after;
    const direction = before != null ? 'before' : 'after';

    // And fetch the data. We're going to overfetch by one (e.g., if the page
    // size is 10, we ask for 11 items), as that's a simple strategy that lets
    // us determine here whether we have a next page (when forward paginating)
    // or a previous page (when backwards paginating). Of course, this does not
    // tell us whether there's a next page when we're backwards paginating and a
    // previous page when we're forward paginating, so we just guess/lie here
    // and return false for those cases, as the relay spec allows.
    const { items } = await fetcher({
      size: pageSize + 1,
      cursor: givenCursor ? { value: givenCursor, direction } : undefined,
      takeFrom,
      source,
      args: nonPaginationArgs,
      context,
    });

    const hasExtraPage = items.length > pageSize;
    const exposedData =
      takeFrom === 'start' ? items.slice(0, pageSize) : items.slice(1);

    // The fake cursor we'll return in case the page is empty.
    // TS complains because our fake cursor is not necessarily assignable to the
    // type of our real cursors, which is completely correct. But, since these
    // fake cursors should be unused, we just ignore the error by casting.
    // In case the client does somehow want to use this cursor (maybe to check
    // if our hasXPage flag is lying), we could update the serialized values
    // to support a special EMPTY_COLLECTION cursor.
    const fakeCursor = {} as unknown as CursorValue;

    return {
      edges: exposedData,
      pageInfo: {
        // For these hasXPage flags, we're just always returning false
        // if we don't know, per comment above.
        hasNextPage: takeFrom === 'start' && hasExtraPage,
        hasPreviousPage: takeFrom === 'end' && hasExtraPage,
        startCursor: exposedData[0]?.cursor ?? fakeCursor,
        endCursor: exposedData[exposedData.length - 1]?.cursor ?? fakeCursor,
      },
    };
  };

  return resolver;
}
