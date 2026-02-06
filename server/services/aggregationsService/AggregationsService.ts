import type { ScalarType, TaggedScalar } from '@roostorg/types';
import type { ReadonlyDeep } from 'type-fest';

import { getSignalInputValueOrValues } from '../../condition_evaluator/leafCondition.js';
import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type RuleEvaluationContext } from '../../rule_engine/RuleEvaluator.js';
import { assertUnreachable } from '../../utils/misc.js';
import type SafeTracer from '../../utils/SafeTracer.js';
import {
  getFieldValueForRole,
  type ItemSubmission,
} from '../itemProcessingService/index.js';
import {
  SupportedAggregationGroupByScalarTypes,
  type Aggregation,
  type AggregationClause,
  type AggregationRuntimeArgsForItem,
  type SupportedAggregationGroupByScalarType,
} from './index.js';
import { type StringNumberKeyValueStore } from './StringNumberKeyValueStore.js';

export class AggregationsService {
  private readonly keyValueStore: StringNumberKeyValueStore;

  constructor(keyValueStore: StringNumberKeyValueStore) {
    this.keyValueStore = keyValueStore;
  }

  async updateAggregation(
    aggregation: ReadonlyDeep<AggregationClause>,
    runTimeArgs: AggregationRuntimeArgsForItem,
    tracer: SafeTracer,
  ) {
    const updateAggregationTraced = tracer.traced(
      {
        resource: 'aggregation',
        operation: 'update',
        attributesFromArgs: (args) => {
          return {
            aggregationType: args[0].aggregation.type,
            aggregationId: args[0].id,
          };
        },
      },
      async (aggregation: ReadonlyDeep<AggregationClause>) => {
        const keys = getStoreKeysForAggregation(aggregation, runTimeArgs);
        if (keys.length === 0) {
          return;
        }

        const mostRecentKey = keys[keys.length - 1];
        await this.keyValueStore.increment(
          mostRecentKey,
          aggregation.window.sizeMs * 1.2,
        );
      },
    );

    await updateAggregationTraced(aggregation);
  }

  async evaluateAggregation(
    aggregation: ReadonlyDeep<AggregationClause>,
    runtimeArgs: ReadonlyDeep<AggregationRuntimeArgsForItem>,
  ) {
    const keys = getStoreKeysForAggregation(aggregation, runtimeArgs);

    const kvs = await this.keyValueStore.getAll(keys);
    switch (aggregation.aggregation.type) {
      case 'COUNT':
        return Array.from(kvs.values()).reduce((acc, count) => acc + count, 0);
      default:
        return assertUnreachable(aggregation.aggregation.type);
    }
  }
}

export async function evaluateAggregationRuntimeArgsForItem(
  evalContext: RuleEvaluationContext,
  itemSubmission: ItemSubmission,
  aggregationClause: ReadonlyDeep<AggregationClause>,
): Promise<AggregationRuntimeArgsForItem | undefined> {
  const groupByValueStrings = await getAggregationGroupByValueStrings(
    evalContext,
    aggregationClause,
    itemSubmission,
  );
  if (groupByValueStrings === undefined) {
    return undefined;
  }

  const createdAt = getItemCreatedAtTime(itemSubmission);
  return {
    groupByValueStrings,
    createdAt,
  };
}

function getItemCreatedAtTime(itemSubmission: ItemSubmission) {
  // Get the createdAt field from the schema if it exists, otherwise use the
  // submission time if it exists, and lastly fallback to the current time.
  const createdAtFromSchema = getFieldValueForRole(
    itemSubmission.itemType.schema,
    itemSubmission.itemType.schemaFieldRoles,
    'createdAt',
    itemSubmission.data,
  );

  return createdAtFromSchema
    ? new Date(createdAtFromSchema)
    : itemSubmission.submissionTime ?? new Date();
}

function getStoreKeysForAggregation(
  aggregation: ReadonlyDeep<AggregationClause>,
  runTimeArgs: ReadonlyDeep<AggregationRuntimeArgsForItem>,
) {
  const keyPrefix = getStoreKeyPrefixForAggregation(aggregation, runTimeArgs);

  const windowEndMs = runTimeArgs.createdAt.getTime();
  const windowStartMs = windowEndMs - aggregation.window.sizeMs;

  return getTimeBucketsForTimeRange(
    windowStartMs,
    windowEndMs,
    aggregation.window.hopMs,
  ).map((bucket) => `${keyPrefix}:${bucket}`);
}

function getTimeBucketsForTimeRange(
  startTimeMs: number,
  endTimeMs: number,
  bucketSizeMs: number,
) {
  const startBucket = Math.floor(startTimeMs / bucketSizeMs) * bucketSizeMs;
  const endBucket = Math.floor(endTimeMs / bucketSizeMs) * bucketSizeMs;

  const buckets = [];
  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSizeMs) {
    buckets.push(bucket);
  }

  return buckets;
}

async function getAggregationGroupByValueStrings(
  evaluationContext: RuleEvaluationContext,
  aggregation: ReadonlyDeep<AggregationClause>,
  itemSubmission: ItemSubmission,
) {
  // Get signal input values for all group bys collected as an array. We filter out all
  // group bys over full items as that operation does not require a key.
  const groupByInputValues: (TaggedScalar<ScalarType> | undefined)[] =
    await Promise.all(
      aggregation.groupBy.map(async (groupBy) => {
        return groupBy.type !== 'CONTENT_DERIVED_FIELD'
          ? getSignalInputValueOrValues(groupBy, itemSubmission)
          : evaluationContext.getDerivedFieldValue(groupBy.spec);
      }),
    ).then((results) =>
      results
        .flatMap((result) => result)
        .filter(
          (value): value is TaggedScalar<ScalarType> | undefined =>
            !(value && 'data' in value),
        ),
    );

  // If any group bys are not supported or the evaluation returned undefined,
  // we return undefined.
  const supportedGroupByValues = groupByInputValues
    .filter(
      (value): value is TaggedScalar<SupportedAggregationGroupByScalarType> =>
        value !== undefined &&
        SupportedAggregationGroupByScalarTypes.includes(value.type),
    )
    .map((value) => {
      switch (value.type) {
        case 'USER_ID':
          return value.value.id;
        case 'ID':
          return value.value;
        case 'STRING':
          return value.value;
        default:
          return assertUnreachable(value);
      }
    });

  if (supportedGroupByValues.length !== groupByInputValues.length) {
    return undefined;
  }

  return supportedGroupByValues;
}

function getStoreKeyPrefixForAggregation(
  aggregation: ReadonlyDeep<AggregationClause>,
  aggregationRuntimeArgsForItem: ReadonlyDeep<AggregationRuntimeArgsForItem>,
): string {
  const aggregationPrefix = `aggregation:${serializeAggregation(
    aggregation.aggregation,
  )}:${aggregation.id}:`;

  if (aggregation.groupBy.length === 0) {
    return aggregationPrefix;
  }

  const concatGroupByValues =
    aggregationRuntimeArgsForItem.groupByValueStrings.join(',');
  return `${aggregationPrefix}:${concatGroupByValues}`;
}

function serializeAggregation(aggregation: Aggregation): string {
  switch (aggregation.type) {
    case 'COUNT':
      return 'COUNT';
    default:
      assertUnreachable(aggregation.type);
  }
}

function makeAggregationsService(keyValueStore: Dependencies['KeyValueStore']) {
  return new AggregationsService(keyValueStore);
}

export default inject(['KeyValueStore'], makeAggregationsService);
