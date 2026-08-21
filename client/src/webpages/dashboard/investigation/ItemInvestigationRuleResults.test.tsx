import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useGQLInvestigationItemsQuery } from '../../../graphql/generated';
import ItemInvestigationRuleResults from './ItemInvestigationRuleResults';

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLInvestigationItemsQuery: vi.fn(),
  useGQLMatchingBankNamesQuery: vi.fn(() => ({
    loading: false,
    error: undefined,
    data: undefined,
  })),
}));

const execution = (
  outcome: 'PASSED' | 'FAILED',
  timestamp: string,
  conditionDetail: string,
) => ({
  __typename: 'RuleExecutionResult',
  date: timestamp,
  ts: timestamp,
  contentId: 'content',
  itemTypeName: 'Post',
  itemTypeId: 'post',
  content: '{}',
  environment: 'LIVE',
  passed: outcome === 'PASSED',
  ruleId: 'repeated-rule',
  ruleName: 'Repeated Rule',
  policies: [],
  tags: [],
  result: {
    __typename: 'ConditionSetWithResult',
    conjunction: 'AND',
    conditions: [
      {
        __typename: 'LeafConditionWithResult',
        input: {
          __typename: 'ConditionInputField',
          type: 'CONTENT_FIELD',
          name: conditionDetail,
        },
        comparator: 'EQUALS',
        result: { __typename: 'ConditionResult', outcome },
      },
    ],
    result: { __typename: 'ConditionResult', outcome },
  },
});

describe('ItemInvestigationRuleResults', () => {
  it('shows the stored result for the selected execution', () => {
    vi.mocked(useGQLInvestigationItemsQuery).mockReturnValue({
      loading: false,
      error: undefined,
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
              'FAILED',
              '2026-01-01T20:11:00.000Z',
              'Older execution field',
            ),
            execution(
              'PASSED',
              '2026-01-01T20:13:00.000Z',
              'Newer execution field',
            ),
          ],
        },
      },
    } as unknown as ReturnType<typeof useGQLInvestigationItemsQuery>);

    render(
      <MemoryRouter>
        <ItemInvestigationRuleResults
          itemIdentifier={{ id: 'item', typeId: 'post' }}
          itemTypes={[]}
          rules={[]}
        />
      </MemoryRouter>,
    );

    const failedRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Did Not Match'))!;
    userEvent.click(failedRow);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Rule Result: Repeated Rule')).toBeTruthy();
    const outcome = within(dialog).getByText('Outcome:').parentElement;
    expect(outcome?.textContent).toContain('Did Not Match');
    expect(outcome?.textContent).not.toContain('Matched');
    expect(within(dialog).getByText('Older execution field')).toBeTruthy();
    expect(within(dialog).queryByText('Newer execution field')).toBeNull();
  });
});
