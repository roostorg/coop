import { type Kysely } from 'kysely';
import { uid } from 'uid';

import {
  kyselyCreateRule,
  kyselyDeleteRule,
} from '../../graphql/datasources/ruleKyselyPersistence.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import {
  ConditionConjunction,
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
  type ConditionSet,
} from '../../services/moderationConfigService/index.js';
import { SignalType } from '../../services/signalsService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { logErrorAndThrow } from '../utils.js';
import createUser from './createUser.js';

const DEFAULT_CONDITION_SET: ConditionSet = {
  conditions: [
    {
      input: {
        type: 'CONTENT_FIELD',
        name: 'text',
        contentTypeId: '6f8f8612205',
      },
      signal: {
        id: jsonStringify({ type: SignalType.TEXT_MATCHING_CONTAINS_TEXT }),
        type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
      },
      matchingValues: { strings: ['test'] },
    },
  ],
  conjunction: ConditionConjunction.AND,
};

export default async function createRule(
  db: Kysely<CombinedPg>,
  orgId: string,
  extra: {
    creatorId?: string;
    creator?: { id: string };
    id?: string;
    alarmStatus?: RuleAlarmStatus;
    name?: string;
    ruleType?: RuleType;
    status?: RuleStatus;
    conditionSet?: ConditionSet;
  } = {},
) {
  const ruleId = extra.id ?? uid();
  const name = extra.name ?? `Dummy_Rule_Name_${ruleId}`;
  const ruleType = extra.ruleType ?? RuleType.CONTENT;
  const status = extra.status ?? RuleStatus.LIVE;
  const creatorId =
    extra.creator?.id ??
    extra.creatorId ??
    (await createUser(db, orgId)).user.id;

  await kyselyCreateRule(db, {
    id: ruleId,
    name,
    description: null,
    status,
    conditionSet: extra.conditionSet ?? DEFAULT_CONDITION_SET,
    tags: [],
    maxDailyActions: null,
    expirationTime: null,
    creatorId,
    orgId,
    ruleType,
    parentId: null,
    actionIds: [],
    policyIds: [],
    contentTypeIds: [],
  }).catch(logErrorAndThrow);

  // `kyselyCreateRule` always seeds `INSUFFICIENT_DATA`; patch when callers
  // seed a different alarm status (e.g. anomaly-detection snapshot fixtures).
  const alarmStatus = extra.alarmStatus ?? RuleAlarmStatus.INSUFFICIENT_DATA;
  if (alarmStatus !== RuleAlarmStatus.INSUFFICIENT_DATA) {
    await db
      .updateTable('public.rules')
      .set({ alarm_status: alarmStatus, alarm_status_set_at: new Date() })
      .where('id', '=', ruleId)
      .where('org_id', '=', orgId)
      .execute();
  }

  return {
    id: ruleId,
    orgId,
    creatorId,
    name,
    alarmStatus,
    statusIfUnexpired: status,
    async destroy() {
      await kyselyDeleteRule(db, ruleId, orgId);
    },
  };
}
