import { buildASTSchema, isInputObjectType } from 'graphql';

import typeDefs from '../schema.js';
import {
  assertManualReviewJobIdsWithinLimit,
  MAX_MANUAL_REVIEW_JOB_IDS,
} from './manualReviewTool.js';

describe('manual review job ID limit', () => {
  it('accepts up to the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS }, (_, i) => `${i}`),
      ),
    ).not.toThrow();
  });

  it('rejects requests over the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS + 1 }, (_, i) => `${i}`),
      ),
    ).toThrow(`At most ${MAX_MANUAL_REVIEW_JOB_IDS} job IDs may be requested.`);
  });
});

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
