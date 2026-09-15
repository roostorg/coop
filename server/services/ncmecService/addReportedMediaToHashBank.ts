import { jsonStringify } from '../../utils/encoding.js';
import { type logErrorJson } from '../../utils/logging.js';
import { type HmaService } from '../hmaService/index.js';

export interface AddReportedMediaToHashBankDeps {
  hmaService: Pick<HmaService, 'getBankById' | 'addContentToBank'>;
  logError: typeof logErrorJson;
}

type ReportedMedia = { id: string; typeId: string; url: string };

/** Adds the media of an accepted NCMEC report to the org's selected hash bank.
 * Best-effort: never rejects, so a banking failure cannot turn an accepted
 * report into a retryable one. Failures are logged without the media URL. */
export async function addReportedMediaToHashBank(
  deps: AddReportedMediaToHashBankDeps,
  opts: {
    orgId: string;
    bankId: number | null | undefined;
    ncmecReportId: string;
    media: readonly ReportedMedia[];
  },
): Promise<void> {
  const { orgId, bankId, ncmecReportId, media } = opts;
  if (bankId == null || media.length === 0) {
    return;
  }

  const logFailure = (error: unknown, item?: ReportedMedia) => {
    deps.logError({
      error: toLogSafeError(error, item?.url),
      message: jsonStringify({
        event: 'ncmecReportedMediaBankingFailed',
        orgId,
        ncmecReportId,
        bankId,
        itemId: item?.id,
        itemTypeId: item?.typeId,
      }),
    });
  };

  let bank;
  try {
    bank = await deps.hmaService.getBankById(orgId, bankId);
  } catch (e) {
    logFailure(e);
    return;
  }
  if (!bank) {
    return;
  }
  const { hma_name: hmaName } = bank;

  const results = await Promise.allSettled(
    media.map(async (item) =>
      deps.hmaService.addContentToBank(hmaName, {
        url: item.url,
        metadata: {
          content_id: `${item.typeId}:${item.id}`,
          json: {
            source: 'ncmec_report',
            orgId,
            ncmecReportId,
            itemId: item.id,
            itemTypeId: item.typeId,
          },
        },
      }),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      logFailure(result.reason, media[i]);
    }
  });
}

function toLogSafeError(error: unknown, url: string | undefined) {
  const name = error instanceof Error ? error.name : 'Error';
  let message = error instanceof Error ? error.message : String(error);
  if (url !== undefined) {
    const forms = [
      url,
      encodeURIComponent(url),
      new URLSearchParams({ url }).toString().slice('url='.length),
    ];
    for (const form of forms) {
      message = message.replaceAll(form, '[media url]');
    }
  }
  return { name, message };
}
