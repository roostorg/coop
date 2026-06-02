import _ from 'lodash';
import stringify_ from 'safe-stable-stringify';
const stringify = stringify_ as unknown as (value: unknown) => string | undefined;

import {
  getDerivedFieldValue,
  type DerivedFieldSpec,
} from '../services/derivedFieldsService/index.js';
import { type ItemSubmission } from '../services/itemProcessingService/index.js';
import { type TransientRunSignalWithCache } from '../services/orgAwareSignalExecutionService/index.js';

export default function makeGetDerivedFieldValueWithCache(
  runSignal: TransientRunSignalWithCache,
  orgId: string,
) {
  return _.memoize(
    async (itemSubmission: ItemSubmission, input: DerivedFieldSpec) =>
      getDerivedFieldValue(runSignal, orgId, itemSubmission, input),
    (itemSubmission, input) => stringify([itemSubmission, input]),
  );
}
