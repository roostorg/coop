import { UnrecoverableError } from 'bullmq';

import { type ReportedMediaBankingJobData } from '../queues/reportedMediaBankingQueue.js';
import type { HashBank } from '../services/hmaService/index.js';
import {
  bankReportedMedia,
  type ReportedMediaBankingDeps,
} from './ReportedMediaBankingWorker.js';

const BANK: HashBank = {
  id: 42,
  name: 'Reported CSAM',
  hma_name: 'COOP_ORG1_REPORTED_CSAM',
  description: null,
  enabled_ratio: 1,
  org_id: 'org1',
  created_at: new Date(),
  updated_at: new Date(),
};

const JOB: ReportedMediaBankingJobData = {
  orgId: 'org1',
  hashBankId: BANK.id,
  ncmecReportId: '123',
  itemId: 'img-1',
  itemTypeId: 'type-a',
  url: 'https://cdn.example.com/1.jpg',
};

function makeDeps(
  overrides: Partial<ReportedMediaBankingDeps['hmaService']> = {},
) {
  const deps = {
    hmaService: {
      getBankById: jest.fn().mockResolvedValue(BANK),
      addContentToBank: jest
        .fn()
        .mockResolvedValue({ id: 1, signals: { pdq: 'abc' } }),
      ...overrides,
    },
  };
  return deps as typeof deps & ReportedMediaBankingDeps;
}

describe('bankReportedMedia', () => {
  it('adds the media to the org bank with metadata pointing back to the report', async () => {
    const deps = makeDeps();

    await bankReportedMedia(deps, JOB);

    expect(deps.hmaService.getBankById).toHaveBeenCalledWith('org1', BANK.id);
    expect(deps.hmaService.addContentToBank).toHaveBeenCalledWith(
      BANK.hma_name,
      {
        url: JOB.url,
        metadata: {
          content_id: 'type-a:img-1',
          json: {
            source: 'ncmec_report',
            orgId: 'org1',
            ncmecReportId: '123',
            itemId: 'img-1',
            itemTypeId: 'type-a',
          },
        },
      },
    );
  });

  it('stops retrying when the bank is gone', async () => {
    const deps = makeDeps({ getBankById: jest.fn().mockResolvedValue(null) });

    await expect(bankReportedMedia(deps, JOB)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(deps.hmaService.addContentToBank).not.toHaveBeenCalled();
  });

  it('lets a failed HMA call through, so the queue retries the job', async () => {
    const deps = makeDeps({
      addContentToBank: jest
        .fn()
        .mockRejectedValue(new Error('Failed to add content to bank: 500')),
    });

    const error = await bankReportedMedia(deps, JOB).then(
      () => null,
      (e: unknown) => e,
    );

    // An UnrecoverableError carries the same message but stops the retry, so
    // the type is what this test is about.
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toBe('Failed to add content to bank: 500');
  });
});
