import { RelatedItem } from '@roostorg/coop-types';

import { convertRelatedItemToFieldData } from './ManualReviewJobUserUtils';

describe('convertRelatedItemToFieldData', () => {
  test('renders only the related item id as a field', () => {
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
  // `{ id, typeId, name }` contract. Those fields are also rendered from the
  // associated item's typed schema, so surfacing them here duplicated every
  // shared field (Nickname/Email/IP Address/Birthday/Created Time) — once as an
  // untyped string and once with its real type.
  test('drops denormalized keys that leak into a related item reference', () => {
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

    const fields = convertRelatedItemToFieldData(relatedItemWithExtras);

    expect(fields).toHaveLength(1);
    expect(fields.map((field) => field.name)).toEqual(['id']);
  });
});
