import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import {
  kyselyOrgDeleteById,
  kyselyOrgInsert,
} from '../../graphql/datasources/orgKyselyPersistence.js';
import { type Dependencies } from '../../iocContainer/index.js';
import { logErrorAndThrow } from '../utils.js';

export default async function createOrg(
  deps: Pick<
    Dependencies,
    'KyselyPg' | 'ModerationConfigService' | 'ApiKeyService'
  >,
  id?: string,
  extra: {
    onCallAlertEmail?: string;
  } = {},
) {
  const orgId = id ?? uid();

  const org = await kyselyOrgInsert({
    db: deps.KyselyPg,
    id: orgId,
    name: `Dummy_Company_Name_${orgId}`,
    email: faker.internet.email(),
    websiteUrl: faker.internet.url(),
    onCallAlertEmail: extra.onCallAlertEmail ?? null,
  }).catch(logErrorAndThrow);

  const { apiKey } = await deps.ApiKeyService.createApiKey(
    orgId,
    `Dummy_Company_Name_${orgId}_Key`,
    null,
    null,
  ).catch(logErrorAndThrow);

  const defaultUserItemType = await deps.ModerationConfigService.createDefaultUserType(
    orgId,
  ).catch(logErrorAndThrow);

  return {
    org,
    apiKey,
    defaultUserItemType,
    async cleanup() {
      await kyselyOrgDeleteById(deps.KyselyPg, orgId);
    },
  };
}
