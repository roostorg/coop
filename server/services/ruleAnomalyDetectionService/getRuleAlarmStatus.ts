import binomialTest from '@stdlib/stats-binomial-test';
import _ from 'lodash';

import { RuleAlarmStatus } from '../moderationConfigService/index.js';

const { sum } = _;

/**
 * Determine whether we should flag the rule as being 'in alarm', meaning that
 * its most-recent pass rate looks anomalous.
 *
 * I'm not exactly sure what the math should be here, but it seems like there
 * are two ways to view a rule's pass rate.
 *
 * One is to imagine that there's some static probability of a rule passing, so
 * the number of passes you'd expect to observe would be given by a binomial
 * distribution, which you're sampling (historically and in the latest period).
 * Then, you can look at how many passes were in the latest period and ask (in
 * various ways) if that's consistent w/ the pass rate observed historically.
 *
 * The second view is to see a rule's pass rate as a variable that changes over
 * time, with an independent "seasonal" component (i.e., different cohorts of
 * users regualarly come onto the platform at different times of day/days of the
 * week) and "trend" component (e.g., the pass rate may be going down over time
 * as bad users get deleted). Then, you forecast the next period's pass rate,
 * with a confidence interval on the forecast, and use the error between the
 * forecast and the actual pass rate to detect anomalies.
 *
 * The second approach feels more accurate, but also obviously more complicated.
 * The statistics are beyond me, and I couldn't find any off-the-shelf packages
 * in JS for decomposing the historical data into these trend + seasonal +
 * residual components (they're all in Python or R.)
 *
 * My hacky approach was gonna be to check if the difference between this hour's
 * pass rate and last hour's pass rate was abnormally large (by estimating a
 * normal distribution for the rule's hour-by-hour _pass rate change_, from the
 * samples), and then mark the rule as in alarm if the pass rate went up a lot.
 * The idea was that, by comparing the current hour to the last hour (when
 * finding the pass rate change), we'd be assuming that the best estimate for
 * this hour's pass rate -- if things aren't anomalous -- is last hour's pass
 * rate, which thereby accounts for "seasonal" effects that we might miss if we
 * used some longer-run average as the starting point for estimating what this
 * period's pass rate "should be" (a la the 'static pass rate' model).
 *
 * But one issue is that the last hour's pass rate could also be abnormally low
 * by chance, which we wouldn't have alerted on (since we only alert if it looks
 * like the pass rate is unusually _high_), so then simple regression to the
 * mean in the next period would result in a big difference that could trigger
 * an alert. Relatedly, some rules, especially at some hours, really don't run
 * that many times, so using the hour-by-hour pass rates is not very reliable/
 * accurate (doubly so if we start onboarding smaller users), even though
 * pass rates are very nice in their ability to abstract away changes in the
 * absolute amount of usage at each hour, which we don't care about (and does
 * change a lot). Still, many rules don't pass at all in a given hour, which
 * totally messes this approach up.
 *
 * There's also a bigger issue with looking at the pass rate as a time series,
 * which is that, if we go into alert mode when the pass rate jumps, we don't
 * want to then automatically go out of alert mode while the anomaly is still
 * occurring (i.e., we don't want to too-quickly 'learn' the anomolous value as
 * the 'correct' value, which could happen if we use the last value as the basis
 * for our prediction of the next value, and the anomaly lasts for over an hour).
 *
 * So, for now, I'm sticking with the more naive option (1), but, to kinda-sorta
 * try to capture part of this seasonality idea, while avoiding the trap of an
 * anomalous most-recent hour(s), I'm very-slightly weighting more recent data
 * more heavily when calculating the historical data. This is kinda like
 * "exponential smoothing" in time series analysis.
 *
 * @param stats An array where each item represents one time period, with newer
 *   time periods first. Within an item, the keys represent how many passes and
 *   rule executions there were in that time period.
 * @param confidence A value between 0 and 1 that represents how confident we
 *   have to be before we consider the rule in alarm.
 */
export default function getRuleAlarmStatus(
  stats: { passes: number; runs: number }[],
  confidence = 0.995,
): RuleAlarmStatus {
  const [lastPeriod, ...priorPeriods] = stats;

  // alpha is the exponential smoothing factor (i.e., the weights exponentially
  // decay such that each period gets (1 - alpha) times the weight of the prior
  // one. alpha, is quite low because, again, we don't want to learn an anomaly
  // as the new 'real' value, and because any 'seasonal' changes should be small
  // (so we don't actually need to give much more weight to recent data). A .02
  // smoothing factor each gives each prior period 98% as much weight as the
  // next (i.e., more-recent) period.
  //
  // NB: We're throwing away the _number of weighted passes and runs_, and just
  // looking at the weighted _pass rate_. If we ever want to do a statistical
  // test that relies on the absolute number of (weighted) prior runs to derive
  // some uncertainty bounds, we'll need to scale the weights to sum to 1 first.
  const alpha = 0.02;
  const weights = priorPeriods.map((_, i) => (1 - alpha) ** i);
  const historicalWeightedPassRate =
    sum(priorPeriods.map((it, i) => it.passes * weights[i])) /
    sum(priorPeriods.map((it, i) => it.runs * weights[i]));

  // We've got a few options for the kind of test we can do here:
  //
  // 1) we could just assume that the pass rate from `priorPeriodsMerged` is
  //    the underlying pass rate for the rule (even though it's actually just
  //    an estimate, which might be off if we don't have much historical data),
  //    and then do an exact binomial test against lastPeriod's sample.
  //
  // 2) we can find the difference in pass rates between lastPeriod and the
  //    historical data, and assume that that difference is normally distributed.
  //    this would account for the sample size of the historical data.
  //    (See https://www.itl.nist.gov/div898/handbook/prc/section3/prc33.htm)
  //    the issue is that our binomial distributions are hella skewed (because
  //    the pass rate for some rules is very, very close to zero), so assuming
  //    the pass rate difference is normally distributed isn't strictly right
  //    iiuc. there is (luckily) an off-the-shelf heuristic for when it's good
  //    enough, which is when there's at least 10 passes in both samples.
  //
  // 3) we can run one of the exact tests that work around the fact that our
  //    historical proportion is just an estimate, using different approaches.
  //    see https://stats.stackexchange.com/a/551617/277172. the issue here is
  //    that these are complicated and/or slow.
  //
  // For now, i just stick with the simplest option (1), but return false if it
  // looks like we might not have enough historical data. The threshold for
  // "enough" is hard to find because, if we want our estimated pass rate to be
  // off by no more than 10%, 95% of the time, the number of raw runs we'd need
  // could vary _wildly_ based on the rule's true pass rate. Our rule pass rates
  // seem to be as low as 1 in 100,000, which would require 250,000 runs to have
  // a reliable estimate, which is gonna be too many for smaller users and
  // is unnecessary for rules that pass much more often (e.g., a rule that
  // passed 5% of the time, which is the highest pass rate I can imagine, would
  // only need ~8000 runs, and ~4000 if we only care about our estimate being
  // too high, since we're only alerting when the threshold is exceeded, not
  // when the pass rate is anomolously low). However, if we say that the rule
  // must have been run at least 4000 times, and passed at least twice or been
  // run 125,000+ times, then this covers both extremes, I think. So, we require
  // that + at least 24 periods of data, to hopefully capture some seasonality.
  const priorPasses = sum(priorPeriods.map((it) => it.passes));
  const priorRuns = sum(priorPeriods.map((it) => it.runs));
  const hasAdequateData =
    priorPeriods.length >= 24 &&
    priorRuns >= 4000 &&
    (priorPasses > 2 || priorRuns > 125000);

  if (!hasAdequateData) {
    return RuleAlarmStatus.INSUFFICIENT_DATA;
  }

  // Even with our heuristics above, there are some cases where we're
  // incorrectly flagging things as anomolous because, when the sample sizes are
  // big (as w/ our large users), then even very small errors in the
  // estimate used for the pass rate, or small seasonal effects, can lead us to
  // log an anomaly incorrectly.
  //
  // For example: a rule has run almost 2 million times and has a weighted pass
  // rate of 0.017752. Now, in the latest period, if the rule runs many times
  // (say 8,000+), that's a big enough sample size that we'd expect the pass
  // rate to be pretty close to .017752. Specifically, with 8,000 runs, the
  // expected value is 8000*.017752 = 142 successes, but 99.5% of the time,
  // we'll have 171 passes (pass rate: .021375) or fewer. In real life, we'll
  // semi-routinely get 172-182 passes, and this won't represent anything
  // anomalous. Instead, it just means that our pass rate estimate was still a
  // little off or some seasonal thing is going on in this hour. So, to prevent
  // these kinds of false positives, we make sure that the pass rate in this
  // period is at least 25% higher than the historical weighted pass rate.
  if (lastPeriod.passes / lastPeriod.runs < historicalWeightedPassRate * 1.25) {
    return RuleAlarmStatus.OK;
  }

  const testResults = binomialTest(lastPeriod.passes, lastPeriod.runs, {
    p: historicalWeightedPassRate,
    alternative: 'greater',
    alpha: 1 - confidence,
  });

  // It's an anomaly if we rejected the null hypothesis.
  return testResults.rejected ? RuleAlarmStatus.ALARM : RuleAlarmStatus.OK;
}
