import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { type PolicyActionPenalties } from '../../models/OrgModel.js';
import { jsonStringify, type JsonOf } from '../../utils/encoding.js';
import { unzip2 } from '../../utils/fp-helpers.js';
import { type UserActionStatistics } from './fetchUserActionStatistics.js';
import { type UserSubmissionStatistics } from './fetchUserSubmissionStatistics.js';

const { keyBy, sum, omit } = _;

export type UserScore = 1 | 2 | 3 | 4 | 5;

// This is the score we assign to a user before they've made their first
// submission. It's seen by the content rules that run against a user's first
// submission, and is used by user rules if we try to read a user's score in an
// eventually-consistent way and don't yet see any recorded score for them.
export const initialUserScore = 5;

/**
 * This is a pure function (i.e., it's given all the needed inputs and doesn't
 * do any data fetching or writing) that computes a user's score.
 */
export function computeUserScore(
  userSubmissionStats: Pick<
    UserSubmissionStatistics,
    'itemTypeId' | 'numSubmissions'
  >[],
  userActionStats: Pick<
    UserActionStatistics,
    'actionId' | 'policyId' | 'itemSubmissionIds' | 'count'
  >[],
  actionPenalties: readonly ReadonlyDeep<PolicyActionPenalties>[],
) {
  type PenaltyKeyData = [string, string | null];
  const getPenaltyKey = (it: { actionId: string; policyId: string | null }) =>
    jsonStringify([it.actionId, it.policyId] as PenaltyKeyData);

  const penaltiesByActionAndPolicy = keyBy(actionPenalties, getPenaltyKey);

  // The actions taken against a user fall into two buckets: those taken against
  // their item submissions (by a rule or manually), and those taken against
  // their user id itself (by a user rule or manually). We can identify the
  // actions from user rules by comparing the `count` in a given (action,
  // policy) statistics pair to the number of distinct item_submission_ids. We
  // need to handle these seprately because, for actions triggered on item
  // submissions, we only want to penalize each submitted item once, so we need
  // to merge/dedupe actions to find the penalty of the "most severe" (action,
  // policy) pair that that content item triggered.
  const [userRuleActionStats, itemSubmissionActionStats] = unzip2(
    userActionStats.map((it) => {
      return [
        {
          ...omit(it, 'itemSubmissionIds'),
          count: it.count - it.itemSubmissionIds.length,
        },
        omit(it, 'count'),
      ] as const;
    }),
  );

  // Before we compute the final penalties, figure out which (action, policy)'s
  // penalty we're gonna use for each content submission. This is a little
  // tricky, because each (action, policy) pair can have different penalties
  // associated with it depending on how many "strikes" the user already has
  // against that (action, policy) pair. That leads to complex interactions that
  // we want to ignore; instead, to figure out the most severe, we just look at
  // the first penalty for that pair.
  const itemSubmissionIdsToPenaltyKeys = (() => {
    const res: { [submissionId: string]: JsonOf<PenaltyKeyData>[] } = {};
    for (const stats of itemSubmissionActionStats) {
      const { itemSubmissionIds, actionId, policyId } = stats;

      for (const submissionId of itemSubmissionIds) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        res[submissionId] = (res[submissionId] ?? []).concat(
          getPenaltyKey({ actionId, policyId }),
        );
      }
    }
    return res;
  })();

  // NB: this will filter out some content submissions if none of that
  // submission's (action, penalty) pairs have an associated penalty.
  // Otherwise, it's gonna be an array with one penalty key per submission.
  const itemSubmissionMostSeverePenaltyKeys = Object.entries(
    itemSubmissionIdsToPenaltyKeys,
  ).flatMap(([_, penaltyKeys]) => {
    const maxPenalty = Math.max(
      ...penaltyKeys.map(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        (it) => penaltiesByActionAndPolicy[it]?.penalties[0] ?? 0,
      ),
    );

    const maxPenaltyKey = penaltyKeys.find(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (it) => penaltiesByActionAndPolicy[it]?.penalties[0] === maxPenalty,
    );
    return maxPenaltyKey ? [maxPenaltyKey] : [];
  });

  const finalCountsByPenaltyKey = userRuleActionStats
    .map((it) => [getPenaltyKey(it), it.count] as const)
    .concat(itemSubmissionMostSeverePenaltyKeys.map((it) => [it, 1] as const))
    .reduce(
      (acc, [penaltyKey, count]) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        acc[penaltyKey] = (acc[penaltyKey] ?? 0) + count;
        return acc;
      },
      {} as { [penaltyKey: string]: number },
    );

  const penalties = Object.entries(finalCountsByPenaltyKey).flatMap(
    ([key, count]) => {
      const penaltiesForAction: readonly number[] =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        penaltiesByActionAndPolicy[key]?.penalties ?? [];

      // If the user has had an action taken against them more times than there
      // are penalty values defined -- e.g., action X was taken 4 times, but the
      // penalties are only defined for "strikes" 1-3 -- apply the last penalty
      // value to all further actions.
      const numDefinedPenalties = penaltiesForAction.length;
      const numMissingPenalties = Math.max(0, count - numDefinedPenalties);

      const extraPenalties = Array.from<number>({
        length: numMissingPenalties,
      }).fill(penaltiesForAction[penaltiesForAction.length - 1] ?? 0);

      return penaltiesForAction.slice(0, count).concat(extraPenalties);
    },
  );

  const numSubmissions = userSubmissionStats.reduce(
    (acc, it) => acc + it.numSubmissions,
    0,
  );

  if (numSubmissions === 0) {
    return initialUserScore;
  }

  // The penalties are currently assumed to be 1, 3, 9, and 27 points, for
  // small, medium, large, and extreme penalties, respectively. Meanwhile,
  // each post will get one point. We'd like to not award points for posts
  // that get penalized but, of course, we don't actually know which posts are
  // which. So, instead, we deduct one extra point (to offset the point for
  // the post) for each accrued penalty, even though this will double deduct
  // if one post was penalized multiple times.
  const weightedPenaltyRate = sum(penalties) / numSubmissions;
  if (weightedPenaltyRate <= 0.01) {
    return 5;
  } else if (weightedPenaltyRate <= 0.05) {
    return 4;
  } else if (weightedPenaltyRate <= 0.1) {
    return 3;
  } else if (weightedPenaltyRate <= 0.25) {
    return 2;
  } else {
    return 1;
  }
}
