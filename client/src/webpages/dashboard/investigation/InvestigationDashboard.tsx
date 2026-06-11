import { gql } from '@apollo/client';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';

import DashboardHeader from '../components/DashboardHeader';

import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import ItemInvestigation from './ItemInvestigation';

gql`
  ${ITEM_TYPE_FRAGMENT}
  query InvestigationItemTypes {
    myOrg {
      itemTypes {
        ...ItemTypeFragment
      }
    }
  }
`;

export default function InvestigationDashboard() {
  const [searchParams] = useSearchParams();
  const [id, typeId, submissionTime, ip] = [
    searchParams.get('id') ?? undefined,
    searchParams.get('typeId') ?? undefined,
    searchParams.get('submissionTime') ?? undefined,
    searchParams.get('ip') ?? undefined,
  ];

  return (
    <div className="flex flex-col justify-start mb-8">
      <Helmet>
        <title>Investigations</title>
      </Helmet>
      <DashboardHeader
        title="Investigation Tool"
        subtitle="Plug in an item's ID and see the full item, all of the rules it has run through, and all the actions taken on it."
      />
      <div className="mb-4 divider" />
      <ItemInvestigation
        // Remount when the investigated item (or IP) in the URL changes so the
        // component re-seeds its internal state and refetches. Without this,
        // navigating between items (e.g. via the "Other items from IP" panel)
        // updates the URL but leaves the previously selected item on screen.
        key={`${id ?? ''}-${typeId ?? ''}-${submissionTime ?? ''}-${ip ?? ''}`}
        itemId={id}
        itemTypeId={typeId}
        submissionTime={submissionTime}
        ipAddress={ip}
      />
    </div>
  );
}
