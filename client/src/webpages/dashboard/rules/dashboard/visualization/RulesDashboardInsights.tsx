import './recharts.css';

import { gql } from '@apollo/client';

export type TimeWindow = {
  start: Date;
  end: Date;
};

export enum ChartType {
  LINE = 'LINE',
  BAR = 'BAR',
  PIE = 'PIE',
}

gql`
  query RulesDashboardInsights {
    allRuleInsights {
      actionedSubmissionsByPolicyByDay {
        date
        count
        policy {
          name
          id
        }
      }
      actionedSubmissionsByTagByDay {
        date
        count
        tag
      }
      actionedSubmissionsByActionByDay {
        date
        count
        action {
          name
        }
      }
      actionedSubmissionsByDay {
        date
        count
      }
      totalSubmissionsByDay {
        date
        count
      }
    }
  }

  query PolicyRollupData {
    myOrg {
      id
      policies {
        id
        name
        parentId
      }
    }
  }
  query ActionStatisticsData($input: ActionStatisticsInput!) {
    actionStatistics(input: $input) {
      item_type_id
      action_id
      policy_id
      rule_id
      source
      count
      time
      count
    }
  }
`;
