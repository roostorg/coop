import { jsonStringify } from '../../utils/encoding.js';
import type { HashBank } from '../hmaService/index.js';
import {
  addReportedMediaToHashBank,
  type AddReportedMediaToHashBankDeps,
} from './addReportedMediaToHashBank.js';

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

const MEDIA = [
  { id: 'img-1', typeId: 'type-a', url: 'https://cdn.example.com/1.jpg?sig=x' },
  { id: 'img-2', typeId: 'type-a', url: 'https://cdn.example.com/2.jpg' },
  { id: 'vid-1', typeId: 'type-b', url: 'https://cdn.example.com/1.mp4' },
];

function makeDeps(
  overrides: Partial<AddReportedMediaToHashBankDeps['hmaService']> = {},
) {
  const deps = {
    hmaService: {
      getBankById: jest.fn().mockResolvedValue(BANK),
      addContentToBank: jest
        .fn()
        .mockResolvedValue({ id: 1, signals: { pdq: 'abc' } }),
      ...overrides,
    },
    logError: jest.fn(),
  };
  return deps as typeof deps & AddReportedMediaToHashBankDeps;
}

describe('addReportedMediaToHashBank', () => {
  it('does nothing when the org has no bank selected', async () => {
    const deps = makeDeps();

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: null,
      ncmecReportId: '123',
      media: MEDIA,
    });

    expect(deps.hmaService.getBankById).not.toHaveBeenCalled();
    expect(deps.hmaService.addContentToBank).not.toHaveBeenCalled();
  });

  it('does nothing when the report has no media', async () => {
    const deps = makeDeps();

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: BANK.id,
      ncmecReportId: '123',
      media: [],
    });

    expect(deps.hmaService.addContentToBank).not.toHaveBeenCalled();
  });

  it('does not add content when the selected bank is not found for the org', async () => {
    const deps = makeDeps({ getBankById: jest.fn().mockResolvedValue(null) });

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: BANK.id,
      ncmecReportId: '123',
      media: MEDIA,
    });

    expect(deps.hmaService.getBankById).toHaveBeenCalledWith('org1', BANK.id);
    expect(deps.hmaService.addContentToBank).not.toHaveBeenCalled();
  });

  it('adds every reported media item with metadata identifying the item and report', async () => {
    const deps = makeDeps();

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: BANK.id,
      ncmecReportId: '123',
      media: MEDIA,
    });

    expect(deps.hmaService.addContentToBank).toHaveBeenCalledTimes(3);
    expect(deps.hmaService.addContentToBank).toHaveBeenCalledWith(
      BANK.hma_name,
      {
        url: 'https://cdn.example.com/1.mp4',
        metadata: {
          content_id: 'type-b:vid-1',
          json: {
            source: 'ncmec_report',
            orgId: 'org1',
            ncmecReportId: '123',
            itemId: 'vid-1',
            itemTypeId: 'type-b',
          },
        },
      },
    );
    expect(deps.logError).not.toHaveBeenCalled();
  });

  it('keeps adding the remaining media when one item is rejected, and logs only that item', async () => {
    const addContentToBank = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, signals: {} })
      .mockRejectedValueOnce(new Error('Failed to add content to bank: 400'))
      .mockResolvedValueOnce({ id: 3, signals: {} });
    const deps = makeDeps({ addContentToBank });

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: BANK.id,
      ncmecReportId: '123',
      media: MEDIA,
    });

    expect(addContentToBank).toHaveBeenCalledTimes(3);
    expect(deps.logError).toHaveBeenCalledTimes(1);
    const logged = jsonStringify(deps.logError.mock.calls[0][0]);
    expect(logged).toContain('org1');
    expect(logged).toContain('123');
    expect(logged).toContain('img-2');
    expect(logged).toContain(String(BANK.id));
    expect(logged).toContain('Failed to add content to bank: 400');
  });

  it('never rejects, even when the bank lookup throws', async () => {
    const deps = makeDeps({
      getBankById: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(
      addReportedMediaToHashBank(deps, {
        orgId: 'org1',
        bankId: BANK.id,
        ncmecReportId: '123',
        media: MEDIA,
      }),
    ).resolves.toBeUndefined();

    expect(deps.hmaService.addContentToBank).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledTimes(1);
  });

  it('never writes the media URL to the log, even when the error message contains it', async () => {
    const url = MEDIA[0].url;
    const error = new Error(
      `Failed to parse response body. Response body started with: could not fetch ${url} (${encodeURIComponent(url)}) ${new URLSearchParams({ url }).toString()}`,
      { cause: new Error(url) },
    );
    const deps = makeDeps({
      addContentToBank: jest.fn().mockRejectedValue(error),
    });

    await addReportedMediaToHashBank(deps, {
      orgId: 'org1',
      bankId: BANK.id,
      ncmecReportId: '123',
      media: [MEDIA[0]],
    });

    expect(deps.logError).toHaveBeenCalledTimes(1);
    const logged = jsonStringify(deps.logError.mock.calls[0][0]);
    expect(logged).not.toContain('cdn.example.com');
    expect(logged).toContain('img-1');
  });
});
