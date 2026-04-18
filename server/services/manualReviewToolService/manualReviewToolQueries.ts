import { inject } from '../../iocContainer/index.js';
import { cached } from '../../utils/caching.js';
import { jsonParse, jsonStringify } from '../../utils/encoding.js';
import { type CollapseCases } from '../../utils/typescript-types.js';
import { type Action, type Policy } from '../moderationConfigService/index.js';

type ActionKey = { ids: readonly string[]; orgId: string };

export const makeGetActionsByIdEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) =>
    cached({
      keyGeneration: {
        toString: (it: ActionKey) =>
          jsonStringify({ ...it, ids: [...it.ids].sort() }),
        fromString: (it) => jsonParse(it),
      },
      async producer(actionIds: ActionKey) {
        if (actionIds.ids.length === 0) {
          return [] as CollapseCases<Action>[];
        }
        return moderationConfigService.getActions({
          orgId: actionIds.orgId,
          ids: actionIds.ids,
          readFromReplica: true,
        }) as Promise<CollapseCases<Action>[]>;
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    }),
);

export type GetActionsByIdEventuallyConsistent = ReturnType<
  typeof makeGetActionsByIdEventuallyConsistent
>;

type PolicyKey = { ids: readonly string[]; orgId: string };

export const makeGetPoliciesByIdEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) =>
    cached({
      keyGeneration: {
        toString: (it: PolicyKey) =>
          jsonStringify({ ...it, ids: [...it.ids].sort() }),
        fromString: (it) => jsonParse(it),
      },
      async producer(key: PolicyKey) {
        if (key.ids.length === 0) {
          return [] as Policy[];
        }
        return moderationConfigService.getPoliciesByIds({
          orgId: key.orgId,
          ids: key.ids,
          readFromReplica: true,
        });
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    }),
);

export type GetPoliciesByIdEventuallyConsistent = ReturnType<
  typeof makeGetPoliciesByIdEventuallyConsistent
>;
