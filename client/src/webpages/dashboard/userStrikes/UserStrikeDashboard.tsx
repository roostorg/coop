import {
  BookOpen,
  ChartColumn,
  MousePointerClick,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import DashboardHeader from '../components/DashboardHeader';
import TabBar from '../components/TabBar';

import PolicyScoresTab from './PolicyScoresTab';
import StrikeAnalyticsTab from './StrikeAnalyticsTab';
import StrikeEnabledActionsTab from './StrikeEnabledActionsTab';
import ThresholdsTab from './ThresholdsAndSettingsTab';

const UserStrikeDashboardTabs = [
  'policyScores',
  'strikeEnabledActions',
  'thresholdsAndSettings',
  'strikeAnalytics',
] as const;
type UserStrikeDashboardTab = (typeof UserStrikeDashboardTabs)[number];

export default function UserStrikeDashboard() {
  const dashboardTabsToComponents = {
    policyScores: <PolicyScoresTab />,
    strikeEnabledActions: <StrikeEnabledActionsTab />,
    thresholdsAndSettings: <ThresholdsTab />,
    strikeAnalytics: <StrikeAnalyticsTab />,
  };
  const [activeTab, setActiveTab] =
    useState<UserStrikeDashboardTab>('policyScores');
  const labelForTab = (tab: UserStrikeDashboardTab) => {
    switch (tab) {
      case 'policyScores':
        return 'Policy Scores';
      case 'strikeEnabledActions':
        return 'Strike Enabled Actions';
      case 'thresholdsAndSettings':
        return 'Thresholds & Settings';
      case 'strikeAnalytics':
        return 'Analytics';
    }
  };
  const iconForTab = (tab: UserStrikeDashboardTab) => {
    switch (tab) {
      case 'policyScores':
        return <BookOpen width="22px" />;
      case 'strikeEnabledActions':
        return <MousePointerClick width="22px" />;
      case 'thresholdsAndSettings':
        return <Settings2 width="22px" />;
      case 'strikeAnalytics':
        return <ChartColumn width="22px" />;
    }
  };
  return (
    <div>
      <Helmet>
        <title>User Strikes</title>
      </Helmet>
      <DashboardHeader
        title="User Strikes"
        subtitle="Configure User Strikes through policies and actions.
          Coop automatically keeps count of User Strikes, and can trigger actions when strike thresholds are crossed.
          You can also use User Strike as a Signal in Rules to create additional triggers and actions."
      />
      <TabBar<UserStrikeDashboardTab>
        tabs={UserStrikeDashboardTabs.map((tab) => {
          return {
            label: labelForTab(tab),
            icon: iconForTab(tab),
            value: tab,
          };
        })}
        initialSelectedTab={activeTab ?? 'strikeEnabledActions'}
        currentSelectedTab={activeTab}
        onTabClick={(val) => {
          setActiveTab(val);
        }}
      />
      {dashboardTabsToComponents[activeTab]}
    </div>
  );
}
