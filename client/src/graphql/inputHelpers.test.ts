import { stripTypename, taggedUnionToOneOfInput } from './inputHelpers';

describe('GraphQL input helpers', () => {
  describe('taggedUnionToOneOfInput', () => {
    it('should perform the basic mapping as expected', () => {
      const res = taggedUnionToOneOfInput<'CONTENT_FIELD' | 'FULL_ITEM'>(
        {
          type: 'CONTENT_FIELD',
          name: 'hi',
          contentTypeId: 'abc',
        },
        {
          CONTENT_FIELD: 'contentField',
          FULL_ITEM: 'contentFullObject',
        },
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "contentField": Object {
            "contentTypeId": "abc",
            "name": "hi",
          },
        }
      `);
    });

    it('should use an input object w/ a dummy placeholder field when there are no other keys', () => {
      const res = taggedUnionToOneOfInput<'CONTENT_FIELD' | 'FULL_ITEM'>(
        { type: 'FULL_ITEM' },
        {
          CONTENT_FIELD: 'contentField',
          FULL_ITEM: 'contentFullObject',
        },
      );

      expect(res).toMatchInlineSnapshot(`
        Object {
          "contentFullObject": Object {},
        }
      `);
    });
  });

  describe('stripTypename', () => {
    it('should work', () => {
      expect(
        stripTypename([
          {
            __typename: 'Hello',
            someKey: true,
            otherKey: { __typename: 'a', otherOtherKey: true },
          },
        ]),
      ).toMatchInlineSnapshot(`
        Array [
          Object {
            "otherKey": Object {
              "otherOtherKey": true,
            },
            "someKey": true,
          },
        ]
      `);
    });
  });
});
