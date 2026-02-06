/* eslint-disable max-lines */
import { inject } from '../../iocContainer/utils.js';
import {
  type IActionStatisticsAdapter,
  type ActionCountsInput,
} from '../../plugins/warehouse/queries/IActionStatisticsAdapter.js';
import { YEAR_MS } from '../../utils/time.js';

class ActionStatisticsService {
  constructor(
    private readonly adapter: IActionStatisticsAdapter,
  ) {}

  /**
   * Returns the total number of content submissions actioned on each day,
   * for the given org. Looks across all rules and includes actions triggered
   * manually.
   *
   * Even with the functions that return the number of actioned submissions by
   * policy or tag, this function is necessary because the same content
   * submission may be actioned on under multiple policies/tags, so you'll get
   * the wrong result if you just add up the number of actioned submissions
   * (e.g.) across all policies.
   */
  async getActionedSubmissionCountsByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    return this.adapter.getActionedSubmissionCountsByDay(orgId, startAt);
  }

  async getActionedSubmissionCountsByTagByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    return this.adapter.getActionedSubmissionCountsByTagByDay(
      orgId,
      startAt,
    );
  }

  async getActionedSubmissionCountsByPolicyByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    return this.adapter.getActionedSubmissionCountsByPolicyByDay(
      orgId,
      startAt,
    );
  }

  /**
   * NB: this technically returns just the number of actions of each type taken
   * each day, _not_ the number of submissions that received each action each
   * day. However, those two quantities are the same, except if the same content
   * submission passed to the same action twice (in the same day), which should
   * almost never happen, so sticking with this simpler query is good enough.
   *
   * If we did approx_count_distinct(item_submission_id), instead of count(*),
   * then this would be measuring what's implied by the function name, except
   * that it might be slower and would likely have more error (given how rare
   * it'll be for the same content submission to get the same action twice in a
   * day).
   */
  async getActionedSubmissionCountsByActionByDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    return this.adapter.getActionedSubmissionCountsByActionByDay(
      orgId,
      startAt,
    );
  }

  /**
   * Returns the number of actions taken total across an org by day
   */
  async getActionCountsPerDay(
    orgId: string,
    startAt: Date = new Date(Date.now() - YEAR_MS),
  ) {
    return this.adapter.getActionCountsPerDay(orgId, startAt);
  }

  async getPoliciesSortedByViolationCount(input: {
    filterBy: {
      startDate: Date;
      endDate: Date;
    };
    timeZone: string;
    orgId: string;
  }) {
    return this.adapter.getPoliciesSortedByViolationCount(input);
  }
  async getAllActionCountsGroupByPolicy(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupByPolicy(input);
  }

  async getAllActionCountsGroupByActionId(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupByActionId(input);
  }
  async getAllActionCountsGroupBySource(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupBySource(input);
  }
  async getAllActionCountsGroupByItemTypeId(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupByItemTypeId(input);
  }

  async getAllActionCountsGroupByRule(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupByRule(input);
  }

  async getAllActionCountsGroupBy(input: ActionCountsInput) {
    return this.adapter.getAllActionCountsGroupBy(input);
  }
}

export default inject(['ActionStatisticsAdapter'], ActionStatisticsService);
export { type ActionStatisticsService };
