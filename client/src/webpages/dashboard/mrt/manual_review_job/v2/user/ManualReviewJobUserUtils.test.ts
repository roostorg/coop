import { RelatedItem } from '@roostorg/coop-types';

import { convertRelatedItemToFieldData } from './ManualReviewJobUserUtils';

describe('convertRelatedItemToFieldData', () => {
  test('renders the related item id and drops name/typeId', () => {
    const relatedItem: RelatedItem = {
      id: 'user-123',
      typeId: 'type-456',
      name: 'vinny',
    };

    expect(convertRelatedItemToFieldData(relatedItem)).toEqual([
      {
        name: 'id',
        type: 'STRING',
        required: false,
        container: null,
        value: 'user-123',
      },
    ]);
  });

  // Regression for roostorg/coop#716: a RELATED_ITEM value (e.g. a content
  // item's creator reference) can carry denormalized fields beyond the
  // `{ id, typeId, name }` contract. Those same fields are also rendered from
  // the associated item's typed schema, so without deduping every shared field
  // (Nickname/Email/IP Address/Birthday/Created Time) appeared twice — once as
  // an untyped string here and once with its real type from the schema.
  const relatedItemWithExtras = {
    id: 'user-123',
    typeId: 'type-456',
    name: 'vinny',
    nickname: 'vinny',
    email: 'test_user@example.com',
    ipAddress: '203.0.113.7',
    birthday: '1997-08-18T00:00:00.000Z',
    createdTime: '2026-03-13T23:18:10.000Z',
  } as unknown as RelatedItem;

  test('drops inlined keys already rendered from the typed schema', () => {
    const fields = convertRelatedItemToFieldData(relatedItemWithExtras, [
      'nickname',
      'email',
      'ipAddress',
      'birthday',
      'createdTime',
    ]);

    expect(fields.map((field) => field.name)).toEqual(['id']);
  });

  test('matches schema field names case/whitespace-insensitively', () => {
    const fields = convertRelatedItemToFieldData(relatedItemWithExtras, [
      ' Nickname ',
      'EMAIL',
      'IPAddress',
      'Birthday',
      'CreatedTime',
    ]);

    expect(fields.map((field) => field.name)).toEqual(['id']);
  });

  test('keeps inlined keys that have no typed-schema counterpart', () => {
    const fields = convertRelatedItemToFieldData(relatedItemWithExtras, []);

    expect(fields.map((field) => field.name)).toEqual([
      'id',
      'nickname',
      'email',
      'ipAddress',
      'birthday',
      'createdTime',
    ]);
  });
});
