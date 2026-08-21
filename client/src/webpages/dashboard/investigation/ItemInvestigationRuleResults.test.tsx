import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useGQLInvestigationItemsQuery,
  type GQLRuleEnvironment,
} from '../../../graphql/generated';
import ItemInvestigationRuleResults from './ItemInvestigationRuleResults';

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLInvestigationItemsQuery: vi.fn(),
}));

const execution = (
  ruleId: string,
  ruleName: string,
  environment: GQLRuleEnvironment,
  outcome: 'PASSED' | 'FAILED' | 'ERRORED' | undefined,
) => ({
  __typename: 'RuleExecutionResult',
  date: '2026-01-01T00:00:00Z',
  ts: '2026-01-01T00:00:00Z',
  contentId: `${ruleId}-content`,
  itemTypeName: 'Post',
  itemTypeId: 'post',
  content: '{}',
  environment,
  passed: outcome === 'PASSED',
  ruleId,
  ruleName,
  policies: [`${ruleId} policy`],
  tags: [`${ruleId} tag`],
  result: outcome
    ? {
        __typename: 'ConditionSetWithResult',
        conditions: [],
        result: { __typename: 'ConditionResult', outcome },
      }
    : undefined,
});

function renderResults() {
  render(
    <MemoryRouter>
      <ItemInvestigationRuleResults
        itemIdentifier={{} as never}
        rules={[
          { id: 'z', actions: [{ name: 'Escalate' }] },
          { id: 'b', actions: [{ name: 'Escalate' }] },
          { id: 'a', actions: [{ name: 'Dismiss' }] },
          { id: 's', actions: [{ name: 'Review' }] },
          { id: 'p', actions: [{ name: 'Approve' }] },
        ]}
      />
    </MemoryRouter>,
  );
}

function ruleNames() {
  return within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('ItemInvestigationRuleResults raw table values', () => {
  beforeEach(() => {
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
            execution('z', 'Zulu Rule', 'LIVE', 'FAILED'),
            execution('b', 'Backtest Rule', 'BACKTEST', 'FAILED'),
            execution('a', 'Alpha Rule', 'RETROACTION', 'ERRORED'),
            execution('s', 'Skipped Rule', 'BACKGROUND', undefined),
            execution('p', 'Passed Rule', 'MANUAL', 'PASSED'),
          ],
        },
      },
    } as unknown as ReturnType<typeof useGQLInvestigationItemsQuery>);
  });

  it('sorts and applies a staged Rule filter using raw rule names', () => {
    renderResults();

    userEvent.click(screen.getByRole('columnheader', { name: /Rule/ }));
    expect(ruleNames()).toEqual([
      'Alpha Rule',
      'Backtest Rule',
      'Passed Rule',
      'Skipped Rule',
      'Zulu Rule',
    ]);

    userEvent.click(screen.getByRole('button', { name: /filter/i }));
    userEvent.click(screen.getByText('Rule', { selector: 'div.text-start' }));
    userEvent.type(screen.getByRole('textbox'), 'Zulu');
    expect(ruleNames()).toEqual([
      'Alpha Rule',
      'Backtest Rule',
      'Passed Rule',
      'Skipped Rule',
      'Zulu Rule',
    ]);

    userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(ruleNames()).toEqual(['Zulu Rule']);
  });

  it('sorts Result by its normalized display value in both directions', () => {
    renderResults();

    const resultHeader = screen.getByRole('columnheader', { name: /Result/ });
    userEvent.click(resultHeader);
    expect(ruleNames()).toEqual([
      'Alpha Rule',
      'Zulu Rule',
      'Backtest Rule',
      'Skipped Rule',
      'Passed Rule',
    ]);

    userEvent.click(resultHeader);
    expect(ruleNames()).toEqual([
      'Passed Rule',
      'Skipped Rule',
      'Backtest Rule',
      'Zulu Rule',
      'Alpha Rule',
    ]);
  });

  it('sorts Status by its normalized display value in both directions', () => {
    renderResults();

    const statusHeader = screen.getByRole('columnheader', { name: /Status/ });
    userEvent.click(statusHeader);
    expect(ruleNames()).toEqual([
      'Skipped Rule',
      'Backtest Rule',
      'Zulu Rule',
      'Passed Rule',
      'Alpha Rule',
    ]);

    userEvent.click(statusHeader);
    expect(ruleNames()).toEqual([
      'Alpha Rule',
      'Passed Rule',
      'Zulu Rule',
      'Backtest Rule',
      'Skipped Rule',
    ]);
  });

  it('offers normalized result, status, and action filter values', () => {
    renderResults();
    userEvent.click(screen.getByRole('button', { name: /filter/i }));

    const expectOptions = (column: string, options: string[]) => {
      userEvent.click(screen.getByText(column, { selector: 'div.text-start' }));
      const combobox = screen.getAllByRole('combobox').at(-1)!;
      userEvent.click(combobox);
      for (const option of options) {
        expect(
          screen.getByText(option, {
            selector: '.ant-select-item-option-content',
          }),
        ).toBeTruthy();
      }
      userEvent.type(combobox, '{esc}');
    };

    expectOptions('Result', ['Failed', 'Errored', 'Inapplicable', 'Passed']);
    expectOptions('Status', [
      'Live',
      'Backtest',
      'Background',
      'Manual',
      'Retroaction',
    ]);
    expectOptions('Actions', ['Escalate', 'Dismiss', 'Review', 'Approve']);
  });
});
