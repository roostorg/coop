import { faker } from '@faker-js/faker';
import { ScalarTypes, type Field } from '@roostorg/types';

import { type Dependencies } from '../../iocContainer/index.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';

export default async function (opts: {
  moderationConfigService: Dependencies['ModerationConfigService'];
  orgId: string;
  numItemTypes?: number;
  extra: { fields?: NonEmptyArray<Field> };
}) {
  const { moderationConfigService, orgId, extra, numItemTypes = 1 } = opts;

  const itemTypes = await Promise.all(
    Array.from({ length: numItemTypes }).map(async () =>
      moderationConfigService.createUserType(orgId, {
        name: `${faker.lorem.words(2)}`,
        description: faker.lorem.sentence(),
        schema: extra.fields ?? [
          {
            name: 'field1',
            type: ScalarTypes.STRING,
            required: false,
            container: null,
          },
        ],
        schemaFieldRoles: {},
      }),
    ),
  );

  return {
    itemTypes,
    cleanup: async () => {
      await Promise.all(
        itemTypes.map(async (it) =>
          moderationConfigService.deleteItemType({ itemTypeId: it.id, orgId }),
        ),
      );
    },
  };
}
