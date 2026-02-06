import { Op } from 'sequelize';

import { inject } from '../../iocContainer/index.js';
import { cached } from '../../utils/caching.js';
import { jsonParse, jsonStringify } from '../../utils/encoding.js';
import { type CollapseCases } from '../../utils/typescript-types.js';
import { type Action } from '../moderationConfigService/index.js';

type ActionKey = { ids: readonly string[]; orgId: string };

export const makeGetActionsByIdEventuallyConsistent = inject(
  ['ActionModel'],
  (Action) =>
    cached({
      keyGeneration: {
        toString: (it: ActionKey) =>
          jsonStringify({ ...it, ids: [...it.ids].sort() }),
        fromString: (it) => jsonParse(it),
      },
      async producer(actionIds) {
        return Action.findAll({
          where: {
            id: { [Op.in]: actionIds.ids },
            orgId: actionIds.orgId,
          },
          // NB: CollapseCases needed to prevent excessive stack depth TS errors downstream
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
  ['PolicyModel'],
  (Policy) =>
    cached({
      async producer(key: PolicyKey) {
        return Policy.findAll({
          where: { id: { [Op.in]: key.ids }, orgId: key.orgId },
        });
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    }),
);

export type GetPoliciesByIdEventuallyConsistent = ReturnType<
  typeof makeGetPoliciesByIdEventuallyConsistent
>;
