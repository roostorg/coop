import { DataSource } from 'apollo-datasource';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type ItemSubmissionForGQL } from '../types.js';

export type UserHistoryForGQL = {
  id: string;
  user: ItemSubmissionForGQL;
};

class InvestigationAPI extends DataSource {
  constructor(
    private readonly itemHistoryQueries: Dependencies['ItemHistoryQueries'],
  ) {
    super();
  }

  async getItemHistory(opts: {
    itemId: string;
    itemTypeId: string;
    orgId: string;
    itemSubmissionTime?: Date;
  }) {
    const [startDate, endDate] = (() => {
      if (!opts.itemSubmissionTime) {
        return [undefined, undefined];
      }

      const submissionTime = new Date(opts.itemSubmissionTime);
      const startDate = new Date(
        submissionTime.getFullYear(),
        submissionTime.getMonth(),
        submissionTime.getDate(),
      );
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);

      return [startDate, endDate];
    })();
    return this.itemHistoryQueries.getItemRuleExecutionsHistory({
      ...opts,
      filters: { startDate, endDate },
    });
  }
}

export default inject(['ItemHistoryQueries'], InvestigationAPI);
export type { InvestigationAPI };
