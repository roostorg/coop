import { type GraphQLResolveInfo } from 'graphql';

import {
  makeBuiltInActionImmutableError,
  makeInvalidActionItemTypeIdsError,
} from '../../services/moderationConfigService/index.js';
import { type Context } from '../resolvers.js';
import { resolvers } from './action.js';

describe.each(['createAction', 'updateAction'] as const)(
  '%s resolver',
  (resolverName) => {
    it('maps invalid item type IDs into the GraphQL union at the input field', async () => {
      const error = makeInvalidActionItemTypeIdsError({
        shouldErrorSpan: false,
      });
      const actionAPI = {
        [resolverName]: jest.fn().mockRejectedValue(error),
      };
      const context = {
        getUser: () => ({ orgId: 'org-id' }),
        dataSources: { actionAPI },
      } as unknown as Context;
      const resolver = resolvers.Mutation[resolverName] as unknown as (
        source: unknown,
        args: { input: object },
        context: Context,
        info: GraphQLResolveInfo,
      ) => unknown;
      if (typeof resolver !== 'function') throw new Error('Missing resolver');

      const result = await resolver(
        {},
        {
          input:
            resolverName === 'createAction'
              ? {
                  name: 'Action',
                  callbackUrl: 'https://example.com',
                  itemTypeIds: ['invalid'],
                }
              : { id: 'action-id', itemTypeIds: ['invalid'] },
        },
        context,
        {} as GraphQLResolveInfo,
      );

      expect(result).toEqual(
        expect.objectContaining({
          __typename: 'InvalidActionItemTypeIdsError',
          name: 'InvalidActionItemTypeIdsError',
          pointer: '/input/itemTypeIds',
        }),
      );
    });
  },
);

describe('updateAction resolver', () => {
  it('maps immutable built-in actions into the GraphQL union', async () => {
    const actionAPI = {
      updateAction: jest
        .fn()
        .mockRejectedValue(
          makeBuiltInActionImmutableError({ shouldErrorSpan: false }),
        ),
    };
    const context = {
      getUser: () => ({ orgId: 'org-id' }),
      dataSources: { actionAPI },
    } as unknown as Context;
    const resolver = resolvers.Mutation.updateAction;
    if (typeof resolver !== 'function') throw new Error('Missing resolver');

    const result = await resolver(
      {},
      { input: { id: 'built-in-id' } },
      context,
      {} as GraphQLResolveInfo,
    );

    expect(result).toEqual(
      expect.objectContaining({
        __typename: 'BuiltInActionImmutableError',
        name: 'BuiltInActionImmutableError',
      }),
    );
  });
});
