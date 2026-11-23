import { kyselyUpdateRolePermissions } from '../../graphql/datasources/rolePersistence.js';
import {
  UserRole,
  type UserPermission,
} from '../../services/userManagementService/index.js';
import { type MockedServer } from '../setupMockedServer.js';
import createUser from './createUser.js';

const password = 'Login-with-permissions-test-password-123!';

/**
 * Logs `request` in as a new user whose role holds exactly `permissions`.
 * Permissions load on every request, so `setPermissions` takes effect on the
 * next request without logging in again.
 */
export default async function loginWithPermissions(
  { deps, request }: Pick<MockedServer, 'deps' | 'request'>,
  orgId: string,
  permissions: readonly UserPermission[],
) {
  // Any system role works; its permissions are replaced below.
  const role = UserRole.EXTERNAL_MODERATOR;
  const { user } = await createUser(deps.KyselyPg, orgId, {
    role,
    approvedByAdmin: true,
    loginMethods: ['password'],
    password,
  });
  const setPermissions = async (next: readonly UserPermission[]) => {
    await kyselyUpdateRolePermissions(deps.KyselyPg, {
      orgId,
      roleKey: role,
      permissions: next,
    });
  };
  await setPermissions(permissions);

  const login = await request.post('/api/v1/graphql').send({
    query: `mutation Login($input: LoginInput!) {
      login(input: $input) { __typename }
    }`,
    variables: { input: { email: user.email, password } },
  });
  expect(login.body.data?.login.__typename).toBe('LoginSuccessResponse');

  return { user, setPermissions };
}
