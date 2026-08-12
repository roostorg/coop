import { v1 as uuidv1 } from 'uuid';

import {
  makeSubmissionId,
  type ItemSubmissionWithTypeIdentifier,
  type NormalizedItemData,
} from '../../services/itemProcessingService/index.js';
import { type ReportHistory } from '../../services/manualReviewToolService/index.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';

/**
 * Builds a minimal DEFAULT-kind manual review job payload suitable for
 * QueueOperations.addJob in tests. Every id is freshly generated, so each
 * call produces a distinct item (and therefore a distinct Bull job).
 */
export default function makeDummyMrtJobPayload(opts?: { createdAt?: Date }) {
  return {
    createdAt: opts?.createdAt ?? new Date(),
    policyIds: [] as string[],
    payload: {
      kind: 'DEFAULT',
      reportHistory: [] as ReportHistory,
      item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        data: instantiateOpaqueType<NormalizedItemData>({}),
        itemTypeIdentifier: {
          id: uuidv1(),
          version: new Date().toISOString(),
          schemaVariant: 'original',
        },
        creator: {
          id: uuidv1(),
          typeId: uuidv1(),
        },
        itemId: uuidv1(),
      }),
      enqueueSourceInfo: { kind: 'REPORT' },
    },
  } as const;
}
