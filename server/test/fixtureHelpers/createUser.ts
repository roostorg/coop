import { faker } from '@faker-js/faker';
import { type Kysely } from 'kysely';
import { uid } from 'uid';

import {
  kyselyUserDeleteById,
  kyselyUserInsert,
} from '../../graphql/datasources/userKyselyPersistence.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type LoginMethod } from '../../services/coreAppTables.js';
import { UserRole } from '../../services/userManagementService/index.js';
import { logErrorAndThrow } from '../utils.js';

// SAML-only by default keeps the `password_null_when_not_present` CHECK
// satisfied without a placeholder password.
const DEFAULT_LOGIN_METHODS: readonly LoginMethod[] = ['saml'];

export default async function createUser(
  db: Kysely<CombinedPg>,
  orgId: string,
  extra: {
    id?: string;
    role?: UserRole;
    loginMethods?: readonly LoginMethod[];
    password?: string | null;
  } = {},
) {
  const userId = extra.id ?? uid();
  const loginMethods = extra.loginMethods ?? DEFAULT_LOGIN_METHODS;
  const password = extra.password ?? null;

  const user = await kyselyUserInsert({
    db,
    id: userId,
    orgId,
    email: faker.internet.email(),
    password,
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    role: extra.role ?? UserRole.ADMIN,
    loginMethods,
  }).catch(logErrorAndThrow);

  return {
    user,
    async cleanup() {
      await kyselyUserDeleteById(db, userId);
    },
  };
}
