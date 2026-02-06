import { gql } from '@apollo/client';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import NavHeader from '../../components/NavHeader';

import { useGQLRuleInfoQuery } from '../../../../graphql/generated';
import RuleInsights from './insights/RuleInsights';
import RuleTestModal from './RuleTestModal';

gql`
  query RuleInfo($id: ID!) {
    me {
      permissions
    }
    rule(id: $id) {
      name
    }
  }
`;

export default function RuleInfo() {
  const { id: ruleId } = useParams<{ id: string | undefined }>();
  const { loading, error, data } = useGQLRuleInfoQuery({
    variables: { id: ruleId! },
    skip: ruleId === undefined,
  });
  const navigate = useNavigate();
  const [testModalOpen, setTestModalOpen] = useState(false);

  if (error) {
    throw error;
  }
  if (!ruleId) {
    throw new Error('Rule ID is required');
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  const name = data?.rule?.name;

  return (
    <div className="flex flex-col justify-start">
      <Helmet>
        <title>{name}</title>
      </Helmet>
      <div className="flex items-center justify-between">
        <NavHeader
          buttons={[
            {
              title: 'Rules',
              onClick: () => navigate('/dashboard/rules/proactive'),
            },
            {
              title: `Rule: ${name}`,
              onClick: () =>
                navigate(`/dashboard/rules/proactive/form/${ruleId}`),
            },
            { title: 'Insights' },
          ]}
        />
        <div className="flex gap-2">
          <CoopButton
            title="Edit Rule"
            destination={`/dashboard/rules/proactive/form/${ruleId}`}
          />
          <CoopButton
            title="Test Rule"
            type="secondary"
            onClick={() => setTestModalOpen(true)}
          />
        </div>
      </div>
      <RuleInsights ruleId={ruleId} />
      {testModalOpen && (
        <RuleTestModal
          ruleId={ruleId}
          onClose={() => setTestModalOpen(false)}
        />
      )}
    </div>
  );
}
