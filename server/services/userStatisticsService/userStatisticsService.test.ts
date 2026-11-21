import { Kysely } from 'kysely';
import { vi } from 'vitest';

import { type PrismaPgClient } from '../../storage/prisma/index.js';
import {
  makeMockWarehouseDialect,
  type WarehouseExecute,
} from '../../test/stubs/makeMockWarehouseKyselyDialect.js';
import { type UserStatisticsServiceWarehouse } from './dbTypes.js';
import { type makeFetchUserActionStatistics } from './fetchUserActionStatistics.js';
import { type makeFetchUserSubmissionStatistics } from './fetchUserSubmissionStatistics.js';
import { internalMakeUserStatisticsService } from './userStatisticsService.js';

describe('UserStatisticsService', () => {
  describe('refreshUserScoresCache', () => {
    test.todo('should fetch stats w/ batching and update accordingly');

    test('is a no-op without warehouse change streams', async () => {
      const warehouseMock = vi
        .fn<WarehouseExecute>()
        .mockImplementation(async (_query) => {
          return { rows: [] };
        });

      // Records every model/method the service touches on the Prisma client.
      const makePrismaSpy = (spy: (key: string | symbol) => void) =>
        new Proxy({} as PrismaPgClient, {
          get(_target, key) {
            spy(key);
            return undefined;
          },
        });
      const pgReadMock = vi.fn();
      const pgWriteMock = vi.fn();

      const fetchUserActionStatisticsMock = vi
        .fn<ReturnType<typeof makeFetchUserActionStatistics>>()
        .mockResolvedValue([]);

      const fetchUserSubmissionStatisticsMock = vi
        .fn<ReturnType<typeof makeFetchUserSubmissionStatistics>>()
        .mockResolvedValue([]);

      const warehouseKysely = new Kysely<UserStatisticsServiceWarehouse>({
        dialect: makeMockWarehouseDialect(warehouseMock),
      });

      const sut = internalMakeUserStatisticsService(
        makePrismaSpy(pgWriteMock),
        makePrismaSpy(pgReadMock),
        warehouseKysely,
        fetchUserActionStatisticsMock,
        fetchUserSubmissionStatisticsMock,
      );

      await sut.refreshUserScoresCache(async () => []);

      expect(pgWriteMock).not.toHaveBeenCalled();
      expect(warehouseMock).not.toHaveBeenCalled();
      expect(fetchUserActionStatisticsMock).not.toHaveBeenCalled();
      expect(fetchUserSubmissionStatisticsMock).not.toHaveBeenCalled();
    });
  });
});
