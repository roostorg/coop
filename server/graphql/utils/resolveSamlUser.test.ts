import { faker } from '@faker-js/faker';
import { type Profile } from '@node-saml/passport-saml';
import { type Request } from 'express';
import fc from 'fast-check';
import { uid } from 'uid';
import { vi } from 'vitest';

import { UserRole } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type default as SafeTracer } from '../../utils/SafeTracer.js';
import { seedSystemRolesForOrg } from '../datasources/rolePersistence.js';
import {
  kyselyUserInsert,
  type UsersDb,
} from '../datasources/userKyselyPersistence.js';
import { resolveSamlUser } from './resolveSamlUser.js';

function makeReq(orgId?: string): Pick<Request, 'params'> {
  return { params: orgId === undefined ? {} : { orgId } };
}

function samlUserInput(orgId: string) {
  return {
    id: uid(),
    orgId,
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: UserRole.ADMIN,
    loginMethods: ['saml'] as const,
    password: null,
  };
}

describe('resolveSamlUser', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    await seedSystemRolesForOrg(deps.KyselyPg, org.id);
    return { org };
  });

  testWithFixture(
    'resolves generated identities only in their callback organization',
    async ({ deps, org }) => {
      const { org: otherOrg } = await createOrg(deps);
      await seedSystemRolesForOrg(deps.KyselyPg, otherOrg.id);
      const orgIds = [org.id, otherOrg.id];

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 1 }), {
            minLength: 2,
            maxLength: 6,
          }),
          async (owners) => {
            // Email is globally unique in the database. Generate its tenant
            // relationship rather than inserting impossible duplicate emails.
            const users = owners.map((owner, index) => ({
              ...samlUserInput(orgIds[owner]),
              email: `identity-${index}-${org.id}@example.com`,
            }));
            try {
              for (const user of users) {
                await kyselyUserInsert({ db: deps.KyselyPg, ...user });
              }
              for (const email of [
                ...users.map((user) => user.email),
                `missing-${uid()}@example.com`,
              ]) {
                for (const orgId of [...orgIds, `missing-${uid()}`]) {
                  const expected = users.find(
                    (user) => user.orgId === orgId && user.email === email,
                  );
                  const result = await new Promise<{
                    error: unknown;
                    user: unknown;
                  }>((resolve, reject) => {
                    resolveSamlUser(
                      deps.KyselyPg,
                      deps.Tracer,
                      makeReq(orgId),
                      { email },
                      (error, user) => resolve({ error, user }),
                    ).catch(reject);
                  });
                  expect(result).toEqual({
                    error: expected ? null : expect.any(Error),
                    user: expected
                      ? expect.objectContaining({ id: expected.id, orgId })
                      : undefined,
                  });
                }
              }
            } finally {
              await deps.KyselyPg.deleteFrom('public.users')
                .where(
                  'id',
                  'in',
                  users.map((user) => user.id),
                )
                .execute();
            }
          },
        ),
        { numRuns: 25, examples: [[[0, 1]], [[1, 0]]] },
      );
    },
    15_000,
  );

  testWithFixture(
    'rejects when orgId is missing from the path',
    async ({ deps }) => {
      const done = vi.fn();
      await resolveSamlUser(
        deps.KyselyPg,
        deps.Tracer,
        makeReq(undefined),
        { email: 'a@example.com' },
        done,
      );
      expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    },
  );

  // A missing/blank email claim must be rejected outright, never coerced
  // (e.g. String(undefined) === "undefined") and used as a lookup key.
  for (const [label, profile] of [
    ['missing', {}],
    ['undefined', { email: undefined }],
    ['empty', { email: '' }],
  ] as const) {
    testWithFixture(
      `rejects without a match when the email claim is ${label}`,
      async ({ deps, org }) => {
        const done = vi.fn();
        await resolveSamlUser(
          deps.KyselyPg,
          deps.Tracer,
          makeReq(org.id),
          profile,
          done,
        );
        expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(done.mock.calls[0][1]).toBeUndefined();
      },
    );
  }

  // Defensive: node-saml types email as a string, but a multi-valued attribute
  // could arrive as an array at runtime — reject, don't coerce.
  testWithFixture(
    'rejects when the email claim is not a string',
    async ({ deps, org }) => {
      const arrayProfile = { email: ['a@example.com'] };
      const done = vi.fn();
      await resolveSamlUser(
        deps.KyselyPg,
        deps.Tracer,
        makeReq(org.id),
        arrayProfile as unknown as Pick<Profile, 'email'>,
        done,
      );
      expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(done.mock.calls[0][1]).toBeUndefined();
    },
  );

  // A genuine DB failure during the lookup must be logged to the tracer (so
  // outages are observable) and surfaced as an internal error, not swallowed.
  test('logs to the tracer and returns an internal error on a DB failure', async () => {
    const dbError = new Error('connection refused');
    const db = {
      selectFrom() {
        throw dbError;
      },
    } as unknown as UsersDb;
    const tracer = {
      logActiveSpanFailedIfAny: vi.fn(),
    } as unknown as SafeTracer;
    const done = vi.fn();

    await resolveSamlUser(
      db,
      tracer,
      makeReq('some-org'),
      { email: 'a@example.com' },
      done,
    );

    expect(tracer.logActiveSpanFailedIfAny).toHaveBeenCalledWith(dbError);
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(done.mock.calls[0][1]).toBeUndefined();
  });
});
