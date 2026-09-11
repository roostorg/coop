import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReportingRuleInsightsSamplesTable from './ReportingRuleInsightsSamplesTable';

const { fetchProactive, fetchReporting } = vi.hoisted(() => ({
  fetchProactive: vi.fn(),
  fetchReporting: vi.fn(),
}));

vi.mock('@/graphql/generated', async () => {
  const actual = await vi.importActual<typeof import('@/graphql/generated')>(
    '@/graphql/generated',
  );
  return {
    ...actual,
    useGQLRuleInsightsTableAllSignalsQuery: () => ({
      loading: false,
      data: { myOrg: { signals: [] } },
    }),
    useGQLReportingRuleInsightsCurrentVersionSamplesQuery: () => ({
      loading: false,
      data: {
        reportingRule: {
          id: 'report-rule-1',
          name: 'Report rule',
          itemTypes: [
            {
              id: 'type-a',
              name: 'Post A',
              baseFields: [{ name: 'body', type: actual.GQLFieldType.String }],
              derivedFields: [],
            },
            {
              id: 'type-b',
              name: 'Post B',
              baseFields: [{ name: 'body', type: actual.GQLFieldType.String }],
              derivedFields: [],
            },
          ],
          insights: {
            samples: [
              {
                ts: '2026-08-09T01:02:03.004Z',
                itemId: 'repeated-item',
                itemTypeName: 'Post A',
                itemTypeId: 'type-a',
                creatorId: 'creator-a',
                creatorTypeId: 'creator-type',
                itemData: '{"body":"first sample"}',
                environment: actual.GQLRuleEnvironment.Live,
              },
              {
                ts: '2026-08-10T14:15:16.789Z',
                itemId: 'repeated-item',
                itemTypeName: 'Post B',
                itemTypeId: 'type-b',
                creatorId: 'creator-b',
                creatorTypeId: 'creator-type',
                itemData: '{"body":"second sample"}',
                environment: actual.GQLRuleEnvironment.Live,
              },
            ],
          },
        },
      },
    }),
    useGQLReportingRuleInsightsPriorVersionSamplesLazyQuery: () => [
      vi.fn(),
      { loading: false },
    ],
    useGQLGetFullResultForRuleLazyQuery: () => [
      fetchProactive,
      { loading: false },
    ],
    useGQLGetFullReportingResultForRuleLazyQuery: () => [
      fetchReporting,
      { loading: false },
    ],
    useGQLItemTypesQuery: () => ({ data: undefined }),
  };
});

describe('ReportingRuleInsightsSamplesTable', () => {
  beforeEach(() => {
    fetchProactive.mockReset();
    fetchReporting.mockReset();
  });

  it('fetches reporting details using the exact selectors from the clicked row', async () => {
    render(
      <MemoryRouter>
        <ReportingRuleInsightsSamplesTable ruleId="report-rule-1" />
      </MemoryRouter>,
    );

    const secondRow = screen.getByText('creator-b').closest('tr');
    expect(secondRow).not.toBeNull();
    fireEvent.click(secondRow!);

    await waitFor(() => expect(fetchReporting).toHaveBeenCalledOnce());
    expect(fetchReporting.mock.calls[0][0].variables).toEqual({
      input: {
        ruleId: 'report-rule-1',
        item: { id: 'repeated-item', typeId: 'type-b' },
        date: '2026-08-10T14:15:16.789Z',
        lookback: 'LATEST',
      },
    });
    expect(fetchProactive).not.toHaveBeenCalled();
  });
});
