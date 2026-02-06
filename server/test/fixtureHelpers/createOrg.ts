import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { logErrorAndThrow } from '../utils.js';

export default async function (
  models: Pick<Dependencies['Sequelize'], 'Org'>,
  moderationConfigService: Dependencies['ModerationConfigService'],
  apiKeyService: Dependencies['ApiKeyService'],
  id?: string,
  extra: {
    onCallAlertEmail?: string;
  } = {},
) {
  const orgId = id ?? uid();
  const org = await models.Org.create({
    id: orgId,
    name: `Dummy_Company_Name_${orgId}`,
    email: faker.internet.email(),
    websiteUrl: faker.internet.url(),
    onCallAlertEmail: extra.onCallAlertEmail ?? undefined,
  }).catch(logErrorAndThrow);

  const { apiKey } = await apiKeyService
    .createApiKey(orgId, `Dummy_Company_Name_${orgId}_Key`, null, null)
    .catch(logErrorAndThrow);

  const defaultUserItemType = await moderationConfigService
    .createDefaultUserType(orgId)
    .catch(logErrorAndThrow);

  return {
    org,
    apiKey,
    defaultUserItemType,
    async cleanup() {
      await org.destroy();
    },
  };
}
