import { faker } from '@faker-js/faker';

import { type Dependencies } from '../../iocContainer/index.js';

export default async function (opts: {
  actionAPI: Dependencies['ActionAPIDataSource'];
  itemTypeIds: string[];
  orgId: string;
  numActions?: number;
}) {
  const { actionAPI, itemTypeIds, orgId, numActions = 1 } = opts;
  const actions = await Promise.all(
    Array.from({ length: numActions }).map(async () =>
      actionAPI.createAction(
        {
          name: faker.word.verb(),
          description: faker.lorem.sentence(),
          callbackUrl: faker.internet.url(),
          itemTypeIds,
        },
        orgId,
      ),
    ),
  );

  return {
    actions,
    async cleanup() {
      await Promise.all(
        actions.map(async (it) => actionAPI.deleteAction(it.id, orgId)),
      );
    },
  };
}
