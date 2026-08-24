import { buildASTSchema, isInputObjectType } from 'graphql';

import typeDefs from '../schema.js';

describe('manual review queue inputs', () => {
  test.each(['CreateManualReviewQueueInput', 'UpdateManualReviewQueueInput'])(
    '%s requires roleIds',
    (inputName) => {
      const input = buildASTSchema(typeDefs).getType(inputName);
      expect(isInputObjectType(input)).toBe(true);
      if (!isInputObjectType(input)) {
        return;
      }

      expect(input.getFields().roleIds.type.toString()).toBe('[ID!]!');
    },
  );
});
