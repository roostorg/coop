import bcrypt from 'bcryptjs';
import { vi } from 'vitest';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  hashPassword,
  passwordMatchesHash,
} from '../../services/userManagementService/index.js';
import { verifyEmailPasswordCredentials } from './userApiCredentials.js';

// `verifyEmailPasswordCredentials` only touches the injected Prisma client
// (user lookup + the rehash-on-login update); `orgSettingsService` and
// `tracer` are separate mocks below.
function makeMockPrisma(opts: {
  userRow: Record<string, unknown> | undefined;
  updateShouldThrow?: boolean;
}) {
  const findFirst = vi.fn().mockResolvedValue(opts.userRow ?? null);

  const updateMany = vi.fn();
  if (opts.updateShouldThrow) {
    updateMany.mockRejectedValue(new Error('update failed'));
  } else {
    // The rehash path ignores the count (zero matched rows = lost the CAS,
    // no-op).
    updateMany.mockResolvedValue({ count: 0 });
  }

  const prisma = {
    users: { findFirst, updateMany },
  } as unknown as Dependencies['PrismaPg'];

  return { prisma, findFirst, updateMany };
}

function makeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    password: 'placeholder',
    first_name: 'Test',
    last_name: 'User',
    roles: { key: 'ADMIN', role_permissions: [] },
    approved_by_admin: true,
    rejected_by_admin: false,
    login_methods: ['password'],
    created_at: new Date(),
    updated_at: new Date(),
    org_id: 'org-456',
    ...overrides,
  };
}

function makeDeps(prisma: Dependencies['PrismaPg']) {
  const getSamlSettings = vi.fn().mockResolvedValue(null);
  const logActiveSpanFailedIfAny = vi.fn();
  return {
    deps: {
      prisma,
      orgSettingsService: { getSamlSettings } as unknown as never,
      tracer: { logActiveSpanFailedIfAny } as unknown as never,
    },
    getSamlSettings,
    logActiveSpanFailedIfAny,
  };
}

describe('verifyEmailPasswordCredentials', () => {
  const password = 'correct horse battery staple';

  it('rehashes a legacy bcrypt hash to Argon2id on successful login', async () => {
    const legacyBcryptHash = await bcrypt.hash(password, 5);
    const userRow = makeUserRow({ password: legacyBcryptHash });
    const { prisma, updateMany } = makeMockPrisma({ userRow });
    const { deps } = makeDeps(prisma);

    const result = await verifyEmailPasswordCredentials(
      deps,
      'test@example.com',
      password,
    );

    expect(result.id).toBe('user-123');
    expect(updateMany).toHaveBeenCalledTimes(1);
    const [[{ data: persistedPatch, where }]] = updateMany.mock.calls;
    expect(persistedPatch.password).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
    // Compare-and-swap guard: the write must be scoped to
    // the exact hash that was just verified, not the user id alone, so a
    // concurrent password change can never be clobbered by a rehash of the
    // old plaintext.
    expect(where).toEqual({ id: 'user-123', password: legacyBcryptHash });
    // Verified through `passwordMatchesHash` — the same path a real login
    // takes — rather than reimplementing the comparison in the test.
    await expect(
      passwordMatchesHash(password, persistedPatch.password),
    ).resolves.toBe(true);
  });

  it('does not rehash when the stored hash is already a current Argon2id hash', async () => {
    const currentHash = await hashPassword(password);
    const userRow = makeUserRow({ password: currentHash });
    const { prisma, updateMany } = makeMockPrisma({ userRow });
    const { deps } = makeDeps(prisma);

    await verifyEmailPasswordCredentials(deps, 'test@example.com', password);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a wrong password and does not attempt a rehash write', async () => {
    const legacyBcryptHash = await bcrypt.hash(password, 5);
    const userRow = makeUserRow({ password: legacyBcryptHash });
    const { prisma, updateMany } = makeMockPrisma({ userRow });
    const { deps } = makeDeps(prisma);

    await expect(
      verifyEmailPasswordCredentials(deps, 'test@example.com', 'wrong'),
    ).rejects.toThrow();

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('surfaces a generic internal-server error and logs when the stored hash cannot be evaluated', async () => {
    // A hash argon2 can't parse makes `passwordMatchesHash` throw. That's not
    // special-cased as "wrong password" — it propagates to the outer
    // catch-all, which logs it and rethrows as a generic `InternalServerError`.
    // The error name is pinned so a reintroduced "treat as non-match" special
    // case fails this test instead of silently reverting: a wrong password
    // throws a distinctly-named `LoginIncorrectPasswordError`.
    const userRow = makeUserRow({
      password: '$argon2id$v=19$m=19456,t=2,p=1$!!!!$!!!!',
    });
    const { prisma, updateMany } = makeMockPrisma({ userRow });
    const { deps, logActiveSpanFailedIfAny } = makeDeps(prisma);

    await expect(
      verifyEmailPasswordCredentials(deps, 'test@example.com', password),
    ).rejects.toMatchObject({ name: 'InternalServerError' });

    expect(logActiveSpanFailedIfAny).toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('fails the login when the rehash write throws', async () => {
    const legacyBcryptHash = await bcrypt.hash(password, 5);
    const userRow = makeUserRow({ password: legacyBcryptHash });
    const { prisma } = makeMockPrisma({
      userRow,
      updateShouldThrow: true,
    });
    const { deps, logActiveSpanFailedIfAny } = makeDeps(prisma);

    // A failing write means something is wrong with the database, and the
    // login fails loudly rather than being quietly downgraded to a success
    // with a stale hash. The user can retry if it was transient.
    await expect(
      verifyEmailPasswordCredentials(deps, 'test@example.com', password),
    ).rejects.toMatchObject({ name: 'InternalServerError' });

    expect(logActiveSpanFailedIfAny).toHaveBeenCalled();
  });
});
