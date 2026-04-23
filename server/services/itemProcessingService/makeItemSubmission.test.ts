import { ScalarTypes, type Field, type FieldType } from '@roostorg/types';

import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type ContentItemType,
  type ContentSchemaFieldRoles,
  type ThreadItemType,
  type ThreadSchemaFieldRoles,
  type UserItemType,
  type UserSchemaFieldRoles,
} from '../moderationConfigService/index.js';
import { getCreator } from './makeItemSubmission.js';
import { type NormalizedItemData } from './toNormalizedItemDataOrErrors.js';

// Field roles like `creatorId` resolve to RELATED_ITEM in the schema, which is
// stored as `{ id, typeId }` in normalized data.
const creatorIdField = {
  name: 'authorId',
  type: ScalarTypes.RELATED_ITEM,
  required: false,
  container: null,
} as const satisfies Field<FieldType>;

const baseSchema = [
  creatorIdField,
  {
    name: 'displayName',
    type: ScalarTypes.STRING,
    required: false,
    container: null,
  } as const,
  {
    name: 'createdAt',
    type: ScalarTypes.DATETIME,
    required: true,
    container: null,
  } as const,
] as const satisfies readonly [Field<FieldType>, ...Field<FieldType>[]];

const baseTypeFields = {
  id: 'test',
  name: 'test',
  description: null,
  version: '1',
  schemaVariant: 'original',
  orgId: 'test-org',
  schema: baseSchema,
} as const;

function makeContentItemType(
  schemaFieldRoles: ContentSchemaFieldRoles,
): ContentItemType {
  return { ...baseTypeFields, kind: 'CONTENT', schemaFieldRoles };
}

function makeThreadItemType(
  schemaFieldRoles: ThreadSchemaFieldRoles,
): ThreadItemType {
  return { ...baseTypeFields, kind: 'THREAD', schemaFieldRoles };
}

function makeUserItemType(
  schemaFieldRoles: UserSchemaFieldRoles,
): UserItemType {
  return {
    ...baseTypeFields,
    kind: 'USER',
    isDefaultUserType: false,
    schemaFieldRoles,
  };
}

const expectedCreator = { id: 'creator-id', typeId: 'creator-type-id' };

const itemDataWithCreator = instantiateOpaqueType<NormalizedItemData>({
  authorId: expectedCreator,
  displayName: 'a post',
  createdAt: '2024-01-01T00:00:00.000Z',
});

const itemDataWithoutCreator = instantiateOpaqueType<NormalizedItemData>({
  displayName: 'a post',
  createdAt: '2024-01-01T00:00:00.000Z',
});

describe('getCreator', () => {
  describe('CONTENT items', () => {
    test('returns the value of the creatorId field role', () => {
      const itemType = makeContentItemType({
        creatorId: 'authorId',
        threadId: 'createdAt',
        createdAt: 'createdAt',
      });
      expect(getCreator(itemType, itemDataWithCreator)).toEqual(
        expectedCreator,
      );
    });

    test('returns undefined when the creatorId role is not configured', () => {
      const itemType = makeContentItemType({});
      expect(getCreator(itemType, itemDataWithCreator)).toBeUndefined();
    });

    test('returns undefined when the creatorId field is missing from the data', () => {
      const itemType = makeContentItemType({
        creatorId: 'authorId',
        threadId: 'createdAt',
        createdAt: 'createdAt',
      });
      expect(getCreator(itemType, itemDataWithoutCreator)).toBeUndefined();
    });
  });

  describe('THREAD items', () => {
    test('returns the value of the creatorId field role', () => {
      const itemType = makeThreadItemType({ creatorId: 'authorId' });
      expect(getCreator(itemType, itemDataWithCreator)).toEqual(
        expectedCreator,
      );
    });

    test('returns undefined when the creatorId role is not configured', () => {
      const itemType = makeThreadItemType({});
      expect(getCreator(itemType, itemDataWithCreator)).toBeUndefined();
    });

    test('returns undefined when the creatorId field is missing from the data', () => {
      const itemType = makeThreadItemType({ creatorId: 'authorId' });
      expect(getCreator(itemType, itemDataWithoutCreator)).toBeUndefined();
    });
  });

  describe('USER items', () => {
    // User items are not "created by" themselves; we never want to populate
    // a creator for them, even if the schema happens to include a field
    // pointing at another item.
    test('always returns undefined', () => {
      const itemType = makeUserItemType({});
      expect(getCreator(itemType, itemDataWithCreator)).toBeUndefined();
    });
  });
});
