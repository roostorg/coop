import { GQLUserPermission, useGQLPermissionsQuery } from '@/graphql/generated';
import { ReactComponent as World2 } from '@/icons/lni/Education/world-2.svg';
import { ReactComponent as TextUnderlineAlt } from '@/icons/lni/Text editor/text-underline-alt.svg';
import { userHasPermissions } from '@/routing/permissions';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';

import CoopButton from '../components/CoopButton';
import DashboardHeader from '../components/DashboardHeader';
import TabBar from '../components/TabBar';

import HashBanksDashboard from './hash/HashBanksDashboard';
import LocationBanksDashboard from './location/LocationBanksDashboard';
import TextBanksDashboard from './text/TextBanksDashboard';

const MatchingBanksDashboardTabs = ['HASH', 'TEXT', 'LOCATION'] as const;
type MatchingBanksDashboardTab = (typeof MatchingBanksDashboardTabs)[number];

export default function MatchingBanksDashboard() {
  const [searchParams] = useSearchParams();
  const kindInSearchParams = searchParams.get('kind');
  const [selectedTab, setSelectedTab] = useState<MatchingBanksDashboardTab>(
    kindInSearchParams &&
      MatchingBanksDashboardTabs.includes(
        kindInSearchParams as MatchingBanksDashboardTab,
      )
      ? (kindInSearchParams as MatchingBanksDashboardTab)
      : 'TEXT',
  );
  const [canEditBanks, setCanEditBanks] = useState(true);
  const { data } = useGQLPermissionsQuery();

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditBanks(
        userHasPermissions(permissions ?? [], [GQLUserPermission.ManageOrg]),
      ),
    [permissions],
  );

  const createButton = (
    <CoopButton
      title={
        selectedTab === 'TEXT'
          ? `Create Text Bank`
          : selectedTab === 'LOCATION'
            ? `Create Location Bank`
            : `Create Hash Bank`
      }
      destination={`form/${
        selectedTab === 'TEXT'
          ? 'text'
          : selectedTab === 'LOCATION'
            ? 'location'
            : 'hash'
      }`}

      disabled={!canEditBanks}
      disabledTooltipTitle="To create Matching Banks, you need Admin permissions."
      disabledTooltipPlacement="bottomRight"
    />
  );

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Matching Banks</title>
      </Helmet>
      <DashboardHeader
        title="Matching Banks"
        subtitle="Matching banks are sets of values that you can reference in your rules. If you want to reuse the same set of values across multiple rules, you can create a bank holding all those values, and then easily reference that bank in your rules."
        rightComponent={createButton}
      />
      <TabBar
        tabs={[
          {
            label: 'Hash Banks',
            icon: <TextUnderlineAlt />,
            value: 'HASH',
          },
          {
            label: 'Text Banks',
            icon: <TextUnderlineAlt />,
            value: 'TEXT',
          },
          {
            label: 'Location Banks',
            icon: <World2 />,
            value: 'LOCATION',
          },
        ]}
        initialSelectedTab={selectedTab}
        onTabClick={(val) => setSelectedTab(val)}
        currentSelectedTab={selectedTab}
      />
      {selectedTab === 'HASH' ? (
        <HashBanksDashboard />
      ) : selectedTab === 'TEXT' ? (
        <TextBanksDashboard />
      ) : (
        <LocationBanksDashboard />
      )}
    </div>
  );
}
