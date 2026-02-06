import { gql } from '@apollo/client';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import NavHeader from '../../components/NavHeader';

import { useGQLReportingRuleInfoQuery } from '../../../../graphql/generated';

gql`
  query ReportingRuleInfo($id: ID!) {
    reportingRule(id: $id) {
      name
    }
  }
`;

export default function ReportingRuleInfo() {
  const { id: ruleId } = useParams<{ id: string | undefined }>();
  const { loading, error, data } = useGQLReportingRuleInfoQuery({
    variables: { id: ruleId! },
    skip: ruleId === undefined,
  });
  const navigate = useNavigate();

  if (error) {
    throw error;
  }
  if (!ruleId) {
    throw new Error('Rule ID is required');
  }
  if (loading) {
    return <FullScreenLoading />;
  }
  const name = data?.reportingRule?.name;

  return (
    <div className="flex flex-col justify-start">
      <Helmet>
        <title>{name}</title>
      </Helmet>
      <div className="flex items-center justify-between">
        <NavHeader
          buttons={[
            {
              title: 'Report Rules',
              onClick: () => navigate('/dashboard/rules/report'),
            },
            {
              title: `Report Rule: ${name}`,
              onClick: () => navigate(`/dashboard/rules/report/form/${ruleId}`),
            },
            { title: 'Insights' },
          ]}
        />
        <CoopButton
          title="Edit Report Rule"
          destination={`/dashboard/rules/report/form/${ruleId}`}
        />
      </div>
    </div>
  );
}
