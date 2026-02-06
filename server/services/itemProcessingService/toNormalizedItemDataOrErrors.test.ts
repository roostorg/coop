import {
  ContainerTypes,
  ScalarTypes,
  type Field,
  type FieldType,
} from '@roostorg/types';
import _ from 'lodash';

import { type NonEmptyArray } from '../../utils/typescript-types.js';
import {
  type ContentSchemaFieldRoles,
  type ItemType,
} from '../moderationConfigService/index.js';
import { toNormalizedItemDataOrErrors } from './toNormalizedItemDataOrErrors.js';

const { omit } = _;

const fakeSchema = [
  {
    name: 'missingRequired',
    type: ScalarTypes.BOOLEAN,
    required: true,
    container: null,
  },
  {
    name: 'name',
    type: ScalarTypes.STRING,
    required: false,
    container: null,
  },
  {
    name: 'num',
    type: ScalarTypes.NUMBER,
    required: false,
    container: null,
  },
  {
    name: 'email',
    required: true,
    type: ScalarTypes.STRING,
    container: null,
  },
  {
    name: 'optionalNull',
    type: ScalarTypes.STRING,
    required: false,
    container: null,
  },
  {
    name: 'geohashInvalid',
    type: ScalarTypes.GEOHASH,
    required: false,
    container: null,
  },
  {
    name: 'requiredNull',
    type: ScalarTypes.STRING,
    required: true,
    container: null,
  },
  {
    name: 'requiredFalsey1',
    type: ScalarTypes.BOOLEAN,
    required: true,
    container: null,
  },
  {
    name: 'requiredFalsey2',
    type: ScalarTypes.NUMBER,
    required: true,
    container: null,
  },
  {
    name: 'requiredFalsey3',
    type: ScalarTypes.STRING,
    required: true,
    container: null,
  },
  {
    name: 'containerWithInvalidItem',
    type: ContainerTypes.ARRAY,
    required: true,
    container: {
      containerType: ContainerTypes.ARRAY,
      valueScalarType: ScalarTypes.STRING,
      keyScalarType: null,
    },
  },
  {
    name: 'validContainer',
    type: ContainerTypes.ARRAY,
    required: true,
    container: {
      containerType: ContainerTypes.ARRAY,
      valueScalarType: ScalarTypes.STRING,
      keyScalarType: null,
    },
  },
  {
    name: 'relatedItem',
    type: ScalarTypes.RELATED_ITEM,
    required: true,
    container: null,
  },
  {
    name: 'relatedItem2',
    type: ScalarTypes.RELATED_ITEM,
    required: true,
    container: null,
  },
  {
    name: 'relatedItem3',
    type: ScalarTypes.RELATED_ITEM,
    required: true,
    container: null,
  },
] as const;

const fakeUserSubmission = {
  name: 'test',
  // NB: we expect num to be valid, but not email.
  num: '130', // should come out cast to a number in the snapshot.
  email: 201,
  optionalNull: null,
  geohashInvalid: {
    geometry: {
      center: {
        lat: 12,
        lng: 12,
      },
      radius: 3,
    },
  },
  // these should all be valid, until requiredNUll.
  requiredFalsey1: false,
  requiredFalsey2: 0,
  requiredFalsey3: '',
  requiredNull: null,
  containerWithInvalidItem: ['test', null],
  validContainer: ['test'],
  relatedItem: {
    id: 'test',
    typeId: 'testTypeId',
    name: 'test name',
  },
  relatedItem2: 'not a related item',
  relatedItem3: {
    id: 'test',
    typeId: 'testTypeId',
    name: { k: 'v' },
  },
};

const fakeSchemaWithFieldRoles = [
  {
    name: 'createdAt',
    type: ScalarTypes.STRING,
    required: false,
    container: null,
  },
  {
    name: 'threadId',
    type: ScalarTypes.RELATED_ITEM,
    required: false,
    container: null,
  },
  {
    name: 'parentId',
    type: ScalarTypes.RELATED_ITEM,
    required: false,
    container: null,
  },
] as const;
const fakeFieldRoles = {
  createdAt: 'createdAt',
  threadId: 'threadId',
  parentId: 'parentId',
} as const;

describe('Content type schemas', () => {
  describe('toNormalizedItemDataOrErrors', () => {
    test('should give proper errors', () => {
      expect(
        toNormalizedItemDataOrErrors(
          ['testTypeId'],
          getFakeItemTypeFromSchema(fakeSchema),
          fakeUserSubmission,
        ),
      ).toMatchInlineSnapshot(`
        [
          [BadRequestError: Invalid Data for Item The field 'missingRequired' is required, but was not provided.],
          [BadRequestError: Invalid Data for Item The field 'email' has an invalid value. The value you provided was: 201. This field, if given, must be a string.],
          [BadRequestError: Invalid Data for Item The field 'geohashInvalid' has an invalid value. The value you provided was: {"geometry":{"center":{"lat":12,"lng":12},"radius":3}}. This field, if given, must be a valid geohash.],
          [BadRequestError: Invalid Data for Item The field 'requiredNull' is required, but was not provided.],
          [BadRequestError: Invalid Data for Item The field 'containerWithInvalidItem' has an invalid value. The value you provided was: ["test",null]. Some items in this field's array were not valid.],
          [BadRequestError: Invalid Data for Item The field 'relatedItem2' has an invalid value. The value you provided was: "not a related item". This field, if given, must be an object with a (non-empty) string 'id' and a valid 'typeId', with an optional string name.],
          [BadRequestError: Invalid Data for Item The field 'relatedItem3' has an invalid value. The value you provided was: {"id":"test","name":{"k":"v"},"typeId":"testTypeId"}. This field, if given, must be an object with a (non-empty) string 'id' and a valid 'typeId', with an optional string name.],
        ]
      `);
    });

    test('should return the normalized version of valid submissions', () => {
      const schemaFieldsToRemove = new Set([
        'missingRequired',
        'requiredNull',
        'containerWithInvalidItem',
        'email',
        'relatedItem2',
        'relatedItem3',
      ]);

      const [validSubmission, validSubmissionSchema] = [
        omit(fakeUserSubmission, [
          'email',
          'geohashInvalid',
          'requiredNull',
          'containerWithInvalidItem',
          'relatedItem2',
          'relatedItem3',
        ]),
        fakeSchema.filter(
          (it) => !schemaFieldsToRemove.has(it.name),
        ) as NonEmptyArray<(typeof fakeSchema)[number]>,
      ];

      expect(
        toNormalizedItemDataOrErrors(
          ['testTypeId'],
          getFakeItemTypeFromSchema(validSubmissionSchema),
          validSubmission,
        ),
      ).toMatchInlineSnapshot(`
        {
          "name": "test",
          "num": 130,
          "relatedItem": {
            "id": "test",
            "name": "test name",
            "typeId": "testTypeId",
          },
          "requiredFalsey1": false,
          "requiredFalsey2": 0,
          "requiredFalsey3": "",
          "validContainer": [
            "test",
          ],
        }
      `);
    });
    test('should fail for invalid field roles when only parentId is provided', () => {
      expect(
        toNormalizedItemDataOrErrors(
          ['testTypeId'],
          getFakeItemTypeFromSchema(fakeSchemaWithFieldRoles, fakeFieldRoles),
          {
            parentId: {
              id: 'test',
              typeId: 'testTypeId',
            },
          },
        ),
      ).toMatchInlineSnapshot(`
        [
          [BadRequestError: Invalid field roles for Item You provided us a parent: parentId without providing a value for when the item was created: createdAt or a value for the thread: threadId],
        ]
      `);
      expect(
        toNormalizedItemDataOrErrors(
          ['testTypeId'],
          getFakeItemTypeFromSchema(fakeSchemaWithFieldRoles, fakeFieldRoles),
          {
            threadId: {
              id: 'test',
              typeId: 'testTypeId',
            },
          },
        ),
      ).toMatchInlineSnapshot(`
        [
          [BadRequestError: Invalid field roles for Item You provided us a thread: threadId without providing a value for when the item was created: createdAt],
        ]
      `);
    });
    test('should pass for valid field roles', () => {
      expect(
        toNormalizedItemDataOrErrors(
          ['testTypeId'],
          getFakeItemTypeFromSchema(fakeSchemaWithFieldRoles, fakeFieldRoles),
          {
            threadId: {
              id: 'test',
              typeId: 'testTypeId',
            },
            parentId: {
              id: 'test',
              typeId: 'testTypeId',
            },
            createdAt: '2023-04-12T19:47:09.406Z',
          },
        ),
      ).toMatchInlineSnapshot(`
        {
          "createdAt": "2023-04-12T19:47:09.406Z",
          "parentId": {
            "id": "test",
            "typeId": "testTypeId",
          },
          "threadId": {
            "id": "test",
            "typeId": "testTypeId",
          },
        }
      `);
    });
  });
});

function getFakeItemTypeFromSchema(
  schema: readonly [Field<FieldType>, ...Field<FieldType>[]],
  schemaFieldRoles: ContentSchemaFieldRoles = {},
): ItemType {
  return {
    id: 'test',
    kind: 'CONTENT',
    name: 'test',
    description: 'test',
    version: 'test',
    schemaVariant: 'original',
    orgId: 'test orgId',
    schemaFieldRoles,
    schema,
  };
}
