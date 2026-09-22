import {
  actionableRelatedActions,
  parseItemCreatedAt,
  relatedActionPublishPayloads,
  sanitizeRelatedActionParameterPayloads,
} from './JobDecisioning.js';

describe('parseItemCreatedAt', () => {
  test('parses a valid ISO string', () => {
    expect(parseItemCreatedAt('2026-01-01T00:00:00.000Z')).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
  });

  test('parses an epoch-millis number', () => {
    expect(parseItemCreatedAt(1735689600000)).toEqual(new Date(1735689600000));
  });

  test('treats epoch 0 as a valid timestamp, not empty', () => {
    expect(parseItemCreatedAt(0)).toEqual(new Date(0));
  });

  test('passes a Date through', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(parseItemCreatedAt(d)).toEqual(d);
  });

  test.each([null, undefined, ''])(
    'returns null for empty value %p',
    (value) => {
      expect(parseItemCreatedAt(value)).toBeNull();
    },
  );

  // Regression: a truthy-but-unparseable createdAt (seen on reports from
  // automated sources) produced an Invalid Date, which throws on pg
  // serialization and failed the entire decision insert, surfacing as
  // "Job submission failed" in the reviewer UI.
  test.each(['   ', 'not-a-date', 'garbage', '2026-99-99T99:99:99Z'])(
    'returns null for unparseable value %p instead of an Invalid Date',
    (value) => {
      expect(parseItemCreatedAt(value)).toBeNull();
    },
  );
});

describe('relatedActionPublishPayloads', () => {
  test('attaches saved parameter values to each related action', () => {
    expect(
      relatedActionPublishPayloads({
        actionIds: ['enqueue_human'],
        itemIds: ['post_2'],
        itemTypeId: 'content',
        policyIds: ['policy_abuse'],
        actionIdsToMrtApiParamDecisionPayload: {
          enqueue_human: { queue: 'priority' },
        },
      }),
    ).toEqual([
      {
        actionId: 'enqueue_human',
        customMrtApiParamDecisionPayload: { queue: 'priority' },
      },
    ]);
  });

  test('omits parameter payload when none were provided', () => {
    expect(
      relatedActionPublishPayloads({
        actionIds: ['hide_content'],
        itemIds: ['post_1'],
        itemTypeId: 'content',
        policyIds: ['policy_spam'],
      }),
    ).toEqual([{ actionId: 'hide_content' }]);
  });
});

describe('actionableRelatedActions', () => {
  test('keeps only related items that have an action and a target', () => {
    expect(
      actionableRelatedActions([
        {
          actionIds: [],
          itemIds: ['post_unmarked'],
          itemTypeId: 'content',
          policyIds: [],
        },
        {
          actionIds: ['hide_content'],
          itemIds: [],
          itemTypeId: 'content',
          policyIds: ['policy_spam'],
        },
        {
          actionIds: ['hide_content'],
          itemIds: ['post_1'],
          itemTypeId: 'content',
          policyIds: ['policy_spam'],
        },
      ]),
    ).toEqual([
      {
        actionIds: ['hide_content'],
        itemIds: ['post_1'],
        itemTypeId: 'content',
        policyIds: ['policy_spam'],
      },
    ]);
  });
});

describe('sanitizeRelatedActionParameterPayloads', () => {
  const parameterizedAction = {
    id: 'enqueue_human',
    actionType: 'CUSTOM_ACTION',
    customMrtApiParams: [
      {
        name: 'queue',
        displayName: 'Queue',
        type: 'SELECT',
        required: true,
        options: [
          { value: 'priority', label: 'Priority' },
          { value: 'default', label: 'Default' },
        ],
      },
    ],
  };

  const relatedAction = {
    actionIds: ['enqueue_human'],
    itemIds: ['post_2'],
    itemTypeId: 'content',
    policyIds: ['policy_abuse'],
    actionIdsToMrtApiParamDecisionPayload: {
      enqueue_human: { queue: 'priority' },
    },
  };

  test('keeps values that match the action parameter spec', () => {
    expect(
      sanitizeRelatedActionParameterPayloads(
        [relatedAction],
        [parameterizedAction],
      ),
    ).toEqual([relatedAction]);
  });

  test('rejects unknown parameter keys', () => {
    expect(() =>
      sanitizeRelatedActionParameterPayloads(
        [
          {
            ...relatedAction,
            actionIdsToMrtApiParamDecisionPayload: {
              enqueue_human: { queue: 'priority', extra: true },
            },
          },
        ],
        [parameterizedAction],
      ),
    ).toThrow(/Unknown parameter/i);
  });

  test('rejects invalid option values', () => {
    expect(() =>
      sanitizeRelatedActionParameterPayloads(
        [
          {
            ...relatedAction,
            actionIdsToMrtApiParamDecisionPayload: {
              enqueue_human: { queue: 'not-an-option' },
            },
          },
        ],
        [parameterizedAction],
      ),
    ).toThrow(/not one of the allowed option values/i);
  });

  test('drops payloads for missing or non-custom actions', () => {
    expect(
      sanitizeRelatedActionParameterPayloads(
        [
          {
            ...relatedAction,
            actionIds: ['missing_action'],
            actionIdsToMrtApiParamDecisionPayload: {
              missing_action: { queue: 'priority' },
            },
          },
        ],
        [parameterizedAction],
      ),
    ).toEqual([
      {
        actionIds: ['missing_action'],
        itemIds: ['post_2'],
        itemTypeId: 'content',
        policyIds: ['policy_abuse'],
      },
    ]);
  });

  test('drops empty payloads when the action has no parameters', () => {
    expect(
      sanitizeRelatedActionParameterPayloads(
        [
          {
            actionIds: ['hide_content'],
            itemIds: ['post_1'],
            itemTypeId: 'content',
            policyIds: ['policy_spam'],
            actionIdsToMrtApiParamDecisionPayload: {
              hide_content: {},
            },
          },
        ],
        [
          {
            id: 'hide_content',
            actionType: 'CUSTOM_ACTION',
            customMrtApiParams: null,
          },
        ],
      ),
    ).toEqual([
      {
        actionIds: ['hide_content'],
        itemIds: ['post_1'],
        itemTypeId: 'content',
        policyIds: ['policy_spam'],
      },
    ]);
  });
});
