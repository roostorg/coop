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
  const [id, typeId, submissionTime] = [
    searchParams.get('id') ?? undefined,
    searchParams.get('typeId') ?? undefined,
    searchParams.get('submissionTime') ?? undefined,
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
        itemId={id}
        itemTypeId={typeId}
        submissionTime={submissionTime}
      />
    </div>
  );
}
