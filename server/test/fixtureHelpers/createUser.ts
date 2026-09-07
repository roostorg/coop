import { faker } from '@faker-js/faker';
import { type Kysely } from 'kysely';
import { uid } from 'uid';

import {
  kyselyUserDeleteById,
  kyselyUserInsert,
} from '../../graphql/datasources/userKyselyPersistence.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  hashPassword,
  UserRole,
} from '../../services/userManagementService/index.js';
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
    /** Plaintext; hashed before insert when provided. */
    password?: string | null;
    approvedByAdmin?: boolean;
  } = {},
) {
  const userId = extra.id ?? uid();
  const loginMethods = extra.loginMethods ?? DEFAULT_LOGIN_METHODS;
  const password =
    extra.password != null && extra.password !== ''
      ? await hashPassword(extra.password)
      : null;

  const user = await kyselyUserInsert({
    db,
    id: userId,
    orgId,
    email: faker.internet.email(),
    password,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: extra.role ?? UserRole.ADMIN,
    loginMethods,
    approvedByAdmin: extra.approvedByAdmin,
  }).catch(logErrorAndThrow);

  return {
    user,
    async cleanup() {
      await kyselyUserDeleteById(db, userId);
    },
  };
}
