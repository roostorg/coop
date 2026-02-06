import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { type User } from '../../models/UserModel.js';
import {
  ConditionConjunction,
  RuleStatus,
  type RuleAlarmStatus,
} from '../../services/moderationConfigService/index.js';
import { SignalType } from '../../services/signalsService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { logErrorAndThrow } from '../utils.js';
import createUser from './createUser.js';

export default async function (
  models: Dependencies['Sequelize'],
  orgId: string,
  extra: {
    creatorId?: string;
    creator?: User;
    id?: string;
    alarmStatus?: RuleAlarmStatus;
    name?: string;
  } = {},
) {
  const finalId = extra.id ?? uid();
  return models.Rule.create({
    id: finalId,
    name: extra.name ?? `Dummy_Rule_Name_${finalId}`,
    status: RuleStatus.LIVE,
    alarmStatus: extra.alarmStatus,
    tags: [],
    orgId,
    ruleType: 'CONTENT',
    creatorId:
      extra.creator?.id ??
      extra.creatorId ??
      (await createUser(models, orgId)).user.id,
    conditionSet: {
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
    },
  }).catch(logErrorAndThrow);
}
