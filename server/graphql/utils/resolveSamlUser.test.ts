import { type Profile } from '@node-saml/passport-saml';
import { type Request } from 'express';

import { type GraphQLUserParent } from '../datasources/userKyselyPersistence.js';
import { resolveSamlUser } from './resolveSamlUser.js';

const stubUser = { id: 'u1', orgId: 'org-a', email: 'a@x.com' };
const userInOrgA = stubUser as unknown as GraphQLUserParent;

function makeReq(orgId?: string): Pick<Request, 'params'> {
  return { params: orgId === undefined ? {} : { orgId } };
}

describe('resolveSamlUser', () => {
  it('passes the user to done when the email + path org match', async () => {
    const findUser = jest.fn(async () => userInOrgA);
    const done = jest.fn();

    await resolveSamlUser(
      findUser,
      makeReq('org-a'),
      { email: 'a@x.com' },
      done,
    );

    expect(findUser).toHaveBeenCalledWith({ email: 'a@x.com', orgId: 'org-a' });
    expect(done).toHaveBeenCalledWith(null, userInOrgA);
  });

  // Security regression (GHSA-2v93-383c-9fw2): an assertion authenticating
  // org-b must not resolve a user who only exists in another org. The lookup
  // is org-scoped, so a cross-org email yields no user and login is rejected.
  it('rejects (error, no user) when the email belongs to a different org', async () => {
    const findUser = jest.fn(async () => undefined);
    const done = jest.fn();

    await resolveSamlUser(
      findUser,
      makeReq('org-b'),
      { email: 'a@x.com' },
      done,
    );

    expect(findUser).toHaveBeenCalledWith({ email: 'a@x.com', orgId: 'org-b' });
    const [err, user] = done.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(user).toBeUndefined();
  });

  it('errors without looking up a user when orgId is missing from the path', async () => {
    const findUser = jest.fn(async () => userInOrgA);
    const done = jest.fn();

    await resolveSamlUser(
      findUser,
      makeReq(undefined),
      { email: 'a@x.com' },
      done,
    );

    expect(findUser).not.toHaveBeenCalled();
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  // A missing/blank email claim must be rejected outright, never coerced
  // (e.g. String(undefined) === "undefined") and used as a lookup key.
  it.each([
    ['missing', {}],
    ['undefined', { email: undefined }],
    ['empty', { email: '' }],
  ])(
    'errors without looking up a user when the email claim is %s',
    async (_label, profile) => {
      const findUser = jest.fn(async () => userInOrgA);
      const done = jest.fn();

      await resolveSamlUser(findUser, makeReq('org-a'), profile, done);

      expect(findUser).not.toHaveBeenCalled();
      expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(done.mock.calls[0][1]).toBeUndefined();
    },
  );

  // Defensive: node-saml types email as a string, but a multi-valued
  // attribute could arrive as an array at runtime — reject, don't coerce.
  it('errors without looking up a user when the email claim is not a string', async () => {
    const arrayProfile = { email: ['a@x.com'] };
    const findUser = jest.fn(async () => userInOrgA);
    const done = jest.fn();

    await resolveSamlUser(
      findUser,
      makeReq('org-a'),
      arrayProfile as unknown as Pick<Profile, 'email'>,
      done,
    );

    expect(findUser).not.toHaveBeenCalled();
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(done.mock.calls[0][1]).toBeUndefined();
  });

  it('errors when no user exists for the email in that org', async () => {
    const findUser = jest.fn(async () => undefined);
    const done = jest.fn();

    await resolveSamlUser(
      findUser,
      makeReq('org-a'),
      { email: 'missing@x.com' },
      done,
    );

    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(done.mock.calls[0][1]).toBeUndefined();
  });

  // A failed lookup must surface to passport via `done(err)`, never as an
  // unhandled rejection out of the verify callback.
  it('reports lookup failures through done instead of rejecting', async () => {
    const findUser = jest.fn(async () => {
      throw new Error('db down');
    });
    const done = jest.fn();

    await expect(
      resolveSamlUser(findUser, makeReq('org-a'), { email: 'a@x.com' }, done),
    ).resolves.toBeUndefined();
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(done.mock.calls[0][1]).toBeUndefined();
  });
});
