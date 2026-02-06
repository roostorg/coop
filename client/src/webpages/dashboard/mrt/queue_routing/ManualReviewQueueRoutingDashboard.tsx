import { useGQLManualReviewHasAppealsEnabledQuery } from '@/graphql/generated';
import { gql } from '@apollo/client';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import DashboardHeader from '../../components/DashboardHeader';
import TabBar from '../../components/TabBar';
import FullScreenLoading from '@/components/common/FullScreenLoading';

import ManualReviewQueueRoutingRulesControls from './RoutingRulesControlPanel';

const RoutingRulesDashboardTabs = ['DEFAULT', 'APPEALS'] as const;
type RoutingRulesDashboardTab = (typeof RoutingRulesDashboardTabs)[number];

gql`
  query ManualReviewHasAppealsEnabled {
    myOrg {
      hasAppealsEnabled
    }
  }
`;

export default function ManualReviewQueueRoutingDashboard() {
  const [selectedTab, setSelectedTab] =
    useState<RoutingRulesDashboardTab>('DEFAULT');
  const labelForTab = (tab: RoutingRulesDashboardTab) => {
    switch (tab) {
      case 'DEFAULT':
        return 'Reports Routing';
      case 'APPEALS':
        return 'Appeals Routing';
    }
  };
  const { data, loading } = useGQLManualReviewHasAppealsEnabledQuery();
  const hasAppealsEnabled = data?.myOrg?.hasAppealsEnabled ?? false;
  const tabs = RoutingRulesDashboardTabs.filter((x) => {
    if (hasAppealsEnabled) {
      return x;
    } else {
      return x !== 'APPEALS';
    }
  });
  const tabBar = (
    <TabBar
      tabs={tabs.map((value) => ({
        label: labelForTab(value),
        value,
      }))}
      initialSelectedTab={selectedTab ?? 'DEFAULT'}
      onTabClick={(val) => setSelectedTab(val)}
      currentSelectedTab={selectedTab}
    />
  );
  if (loading) {
    return <FullScreenLoading />;
  }
  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Routing</title>
      </Helmet>
      <DashboardHeader title="Routing Rules" />
      <span className="mb-3 text-slate-500">
        These Routing Rules will help you route incoming reports to the right
        queues. Here's how they work:
        <br />
        <br />
        <ul>
          <li>
            When we receive a report, we'll run it through these Routing Rules
            one at a time, in order from top to bottom.
          </li>
          <li>
            Each Routing Rule checks the incoming report, and can decide to send
            that report to a particular queue. An example of a Routing Rule is:{' '}
            <span className="italic font-semibold text-slate-500">
              If the item that was reported contains the phrase “anyone want to
              hook up?”, send it to the “Sexual Content Queue”.
            </span>
          </li>
          <li>
            If a Routing Rule does not match on an report, we will run the
            report through the subsequent Routing Rule.
          </li>
          <li>
            If a Routing Rule does match on the report and sends it to a queue,
            we'll stop there and will not run the report through any subsequent
            Routing Rules.
          </li>
        </ul>
        You can click "Reorder Rules" and then drag & drop the rules to re-order
        them.
      </span>
      {tabs.length > 1 ? tabBar : null}
      {selectedTab === 'DEFAULT' ? (
        <ManualReviewQueueRoutingRulesControls isAppeals={false} />
      ) : (
        <ManualReviewQueueRoutingRulesControls isAppeals={true} />
      )}
    </div>
  );
}
