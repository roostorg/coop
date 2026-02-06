import { inject } from '../../iocContainer/utils.js';

export default inject(
  [
    'UserStatisticsService',
    'getPolicyActionPenaltiesEventuallyConsistent',
    'closeSharedResourcesForShutdown',
    'Tracer',
  ],
  (
    userStatsService,
    getPolicyActionPenalties,
    sharedResourceShutdown,
    tracer,
  ) => ({
    type: 'Job' as const,
    async run() {
      await tracer.addActiveSpan(
        { resource: 'userScores', operation: 'refreshScoresCache' },
        async () =>
          userStatsService.refreshUserScoresCache(getPolicyActionPenalties),
      );
    },
    async shutdown() {
      await sharedResourceShutdown();
    },
  }),
);
