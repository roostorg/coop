import {
  useGQLPoliciesQuery,
  useGQLViolationsPerPolicyQuery,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import sum from 'lodash/sum';
import type { SVGProps } from 'react';

import ComponentLoading from '@/components/common/ComponentLoading';

import type { TimeWindow } from '../rules/dashboard/visualization/RulesDashboardInsights';

gql`
  query ViolationsPerPolicy($input: TopPolicyViolationsInput!) {
    topPolicyViolations(input: $input) {
      count
      policyId
    }
  }
`;

export default function OverviewTable(props: {
  title: string;
  icon: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
  iconColor: 'text-teal-300' | 'text-orange-400' | 'text-amber-400';
  groupBy: 'policy';
  timeWindow: TimeWindow;
}) {
  const { title, icon: Icon, iconColor, groupBy, timeWindow } = props;

  const { data, loading, error } = useGQLViolationsPerPolicyQuery({
    variables: {
      input: {
        filterBy: {
          startDate: timeWindow.start,
          endDate: timeWindow.end,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  const policyViolationCounts = data?.topPolicyViolations;

  const {
    data: policiesData,
    loading: policiesLoading,
    error: policiesError,
  } = useGQLPoliciesQuery();
  const policies = policiesData?.myOrg?.policies;

  if (error || policiesError) {
    throw error ?? policiesError!;
  }

  const table = (() => {
    switch (groupBy) {
      case 'policy':
        return (
          <table className="w-full">
            <thead className="sticky top-0">
              <tr className="font-bold bg-slate-50">
                <th className="py-4 pl-3 text-left">Policy name</th>
                <th className="px-1 py-4 text-left">Policy level</th>
                <th className="py-4 pr-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policyViolationCounts?.map((it, i) => {
                const policy = policies?.find((p) => p.id === it.policyId);
                const policyLevel =
                  policy?.parentId == null
                    ? 'Top level'
                    : `Sub-policy of ${
                        policies?.find((p) => p.id === policy?.parentId)
                          ?.name ?? 'Unknown'
                      }`;
                return (
                  <tr
                    key={it.policyId}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="py-2 pl-3 text-left">
                      {policy?.name ?? 'Unknown'}
                    </td>
                    <td className="px-1 py-2 text-left">{policyLevel}</td>
                    <td className="py-2 pr-3 text-left">
                      {it.count.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
    }
  })();

  const emptyChart = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 rounded bg-slate-100">
      <div className="text-xl">We didn't find any results for this query</div>
    </div>
  );

  return (
    <div className="flex flex-col w-full p-6 bg-white border border-solid rounded-lg border-slate-200">
      <div className="flex pb-6">
        <div className="flex items-start gap-2">
          <Icon className={`flex w-6 h-6 ${iconColor}`} />
          <div className="flex justify-between gap-2 grow">
            <div className="flex flex-col text-start">
              <div className="pb-2 text-lg font-bold">{title}</div>
              <div className="text-sm text-slate-400">
                {loading || policiesLoading ? (
                  <ComponentLoading />
                ) : (
                  `Total: ${sum(
                    policyViolationCounts?.map((it) => it.count),
                  ).toLocaleString()}`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="z-10 flex flex-col w-full h-[400px] overflow-y-scroll pb-4">
        {!loading && !policiesLoading && policyViolationCounts?.length === 0
          ? emptyChart
          : table}
      </div>
    </div>
  );
}
