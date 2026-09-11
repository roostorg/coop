import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import ReportingRuleInfo from './ReportingRuleInfo';

vi.mock('@/graphql/generated', async () => {
  const actual = await vi.importActual<typeof import('@/graphql/generated')>(
    '@/graphql/generated',
  );
  return {
    ...actual,
    useGQLReportingRuleInfoQuery: () => ({
      loading: false,
      error: undefined,
      data: { reportingRule: { name: 'Test report rule' } },
    }),
  };
});

vi.mock('./insights/ReportingRuleInsights', () => ({
  default: ({ ruleId }: { ruleId: string }) => (
    <div>Reporting insights for {ruleId}</div>
  ),
}));

describe('ReportingRuleInfo', () => {
  it('renders the reporting rule insights for the route rule', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={['/dashboard/rules/report/info/report-rule-id']}
        >
          <Routes>
            <Route
              path="/dashboard/rules/report/info/:id"
              element={<ReportingRuleInfo />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(
      await screen.findByText('Reporting insights for report-rule-id'),
    ).toBeTruthy();
  });
});
