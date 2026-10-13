import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  GQLConditionConjunction,
  GQLConditionInputInputType,
  GQLConditionOutcome,
  GQLInvestigationItemsDocument,
  GQLRuleEnvironment,
  GQLValueComparator,
  type GQLInvestigationItemsQuery,
  type GQLInvestigationItemsQueryVariables,
  type GQLItemType,
} from '../../../graphql/generated';
import ItemInvestigationRuleResults from './ItemInvestigationRuleResults';

const execution = (
  outcome: GQLConditionOutcome,
  timestamp: string,
  fieldName: string,
) => ({
  __typename: 'RuleExecutionResult' as const,
  date: timestamp,
  ts: timestamp,
  contentId: 'content',
  itemTypeName: 'Post',
  itemTypeId: 'post',
  userId: null,
  userTypeId: null,
  content: '{}',
  environment: GQLRuleEnvironment.Live,
  passed: outcome === GQLConditionOutcome.Passed,
  ruleId: 'repeated-rule',
  ruleName: 'Repeated Rule',
  policies: [],
  tags: [],
  result: {
    __typename: 'ConditionSetWithResult' as const,
    conjunction: GQLConditionConjunction.And,
    conditions: [
      {
        __typename: 'LeafConditionWithResult' as const,
        comparator: GQLValueComparator.Equals,
        threshold: 5,
        input: {
          __typename: 'ConditionInputField' as const,
          type: GQLConditionInputInputType.ContentField,
          name: fieldName,
          contentTypeId: 'post',
          spec: null,
        },
        signal: null,
        matchingValues: null,
        result: {
          __typename: 'ConditionResult' as const,
          outcome,
          score: null,
          matchedValue: null,
        },
      },
    ],
    result: {
      __typename: 'ConditionResult' as const,
      outcome,
      score: null,
      matchedValue: null,
    },
  },
});

describe('ItemInvestigationRuleResults', () => {
  it('waits for item types before showing the selected execution with a threshold', async () => {
    const investigationMock: MockedResponse<
      GQLInvestigationItemsQuery,
      GQLInvestigationItemsQueryVariables
    > = {
      request: {
        query: GQLInvestigationItemsDocument,
        variables: { itemIdentifier: { id: 'item', typeId: 'post' } },
      },
      result: {
        data: {
          __typename: 'Query',
          itemWithHistory: {
            __typename: 'ItemHistoryResult',
            item: {
              __typename: 'ContentItem',
              id: 'item',
              submissionId: 'submission',
              type: { __typename: 'ContentItemType', id: 'post' },
            },
            executions: [
              execution(
                GQLConditionOutcome.Failed,
                '2026-01-01T20:11:00.000Z',
                'Original biography',
              ),
              execution(
                GQLConditionOutcome.Passed,
                '2026-01-01T20:13:00.000Z',
                'Updated biography',
              ),
            ],
          },
        },
      },
    };

    const { rerender } = render(
      <MockedProvider mocks={[investigationMock]}>
        <MemoryRouter>
          <ItemInvestigationRuleResults
            itemIdentifier={{ id: 'item', typeId: 'post' }}
            itemTypes={[]}
            rules={[]}
          />
        </MemoryRouter>
      </MockedProvider>,
    );

    const rows = await screen.findAllByRole('row');
    const failedExecution = rows.find((row) =>
      within(row).queryByText('Did Not Match'),
    );
    expect(failedExecution).toBeDefined();

    await userEvent.click(failedExecution!);

    expect(
      within(screen.getByRole('dialog')).getByRole('status', {
        name: 'loading',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Original biography')).toBeNull();

    const itemTypes: GQLItemType[] = [
      {
        __typename: 'ContentItemType',
        id: 'post',
        name: 'Post',
        version: '1',
        schemaVariant: 'ORIGINAL',
        schemaFieldRoles: { __typename: 'ContentSchemaFieldRoles' },
        derivedFields: [],
        hiddenFields: [],
        baseFields: ['Original biography', 'Updated biography'].map((name) => ({
          __typename: 'BaseField',
          name,
          type: 'NUMBER',
          required: false,
        })),
      },
    ];
    rerender(
      <MockedProvider mocks={[investigationMock]}>
        <MemoryRouter>
          <ItemInvestigationRuleResults
            itemIdentifier={{ id: 'item', typeId: 'post' }}
            itemTypes={itemTypes}
            rules={[]}
          />
        </MemoryRouter>
      </MockedProvider>,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(within(dialog).getByText('Rule Result: Repeated Rule')).toBeTruthy();
    const outcome = within(dialog).getByText('Outcome:').parentElement;
    expect(within(outcome!).getByText('Did Not Match')).toBeTruthy();
    expect(within(dialog).getByText('Original biography')).toBeTruthy();
    expect(within(dialog).getByText('5')).toBeInTheDocument();
    expect(within(dialog).queryByText('Updated biography')).toBeNull();
  });
});
