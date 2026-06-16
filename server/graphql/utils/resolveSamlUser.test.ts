import { faker } from '@faker-js/faker';
import { type Profile } from '@node-saml/passport-saml';
import { type Request } from 'express';
import { uid } from 'uid';

import { UserRole } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { type default as SafeTracer } from '../../utils/SafeTracer.js';
import {
  kyselyUserDeleteById,
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
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    role: UserRole.ADMIN,
    loginMethods: ['saml'] as const,
    password: null,
  };
}

describe('resolveSamlUser', () => {
  const testWithFixture = makeTestWithFixture(async () => {
    const { deps, shutdown } = await makeMockedServer();
    const { org, cleanup: orgCleanup } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return {
      deps,
      org,
      async cleanup() {
        await orgCleanup();
        await shutdown();
      },
    };
  });

  testWithFixture(
    'passes the user to done when the email belongs to the path org',
    async ({ deps, org }) => {
      const input = samlUserInput(org.id);
      await kyselyUserInsert({ db: deps.KyselyPg, ...input });
      const done = jest.fn();
      try {
        await resolveSamlUser(
          deps.KyselyPg,
          deps.Tracer,
          makeReq(org.id),
          { email: input.email },
          done,
        );
        expect(done).toHaveBeenCalledTimes(1);
        const [err, user] = done.mock.calls[0];
        expect(err).toBeNull();
        expect(user).toMatchObject({ id: input.id, orgId: org.id });
      } finally {
        await kyselyUserDeleteById(deps.KyselyPg, input.id);
      }
    },
  );

  // Security regression (GHSA-2v93-383c-9fw2): an assertion authenticating one
  // org must never resolve a user who lives in another org.
  testWithFixture(
    'rejects when the email belongs to a different org',
    async ({ deps, org }) => {
      const input = samlUserInput(org.id);
      await kyselyUserInsert({ db: deps.KyselyPg, ...input });
      const done = jest.fn();
      try {
        await resolveSamlUser(
          deps.KyselyPg,
          deps.Tracer,
          makeReq(`different-org-${uid()}`),
          { email: input.email },
          done,
        );
        const [err, user] = done.mock.calls[0];
        expect(err).toBeInstanceOf(Error);
        expect(user).toBeUndefined();
      } finally {
        await kyselyUserDeleteById(deps.KyselyPg, input.id);
      }
    },
  );

  testWithFixture(
    'rejects when no user exists for the email in that org',
    async ({ deps, org }) => {
      const done = jest.fn();
      await resolveSamlUser(
        deps.KyselyPg,
        deps.Tracer,
        makeReq(org.id),
        { email: `missing-${uid()}@example.com` },
        done,
      );
      expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(done.mock.calls[0][1]).toBeUndefined();
    },
  );

  testWithFixture(
    'rejects when orgId is missing from the path',
    async ({ deps }) => {
      const done = jest.fn();
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
        const done = jest.fn();
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
      const done = jest.fn();
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
      logActiveSpanFailedIfAny: jest.fn(),
    } as unknown as SafeTracer;
    const done = jest.fn();

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
