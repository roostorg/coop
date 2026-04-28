import {
  validateUserCreateInput,
  validateUserUpdatePatch,
} from './userValidation.js';

describe('userValidation', () => {
  describe('validateUserCreateInput', () => {
    const validInput = {
      email: 'test_user@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMIN',
      loginMethods: ['saml'] as const,
      password: null,
    };

    test('accepts a fully valid input (SAML, no password)', () => {
      expect(validateUserCreateInput(validInput)).toEqual({ ok: true });
    });

    test('accepts a valid password-login input', () => {
      expect(
        validateUserCreateInput({
          ...validInput,
          loginMethods: ['password'],
          password: 'hashed-password-placeholder',
        }),
      ).toEqual({ ok: true });
    });

    test.each([
      ['empty', ''],
      ['missing @', 'not-an-email'],
      ['missing domain', 'foo@'],
      ['contains space', 'foo @bar.com'],
    ])('rejects email that is %s', (_label, email) => {
      const result = validateUserCreateInput({ ...validInput, email });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('email');
      }
    });

    test.each([
      ['empty firstName', { firstName: '' }, 'firstName'],
      ['whitespace firstName', { firstName: '   ' }, 'firstName'],
      ['empty lastName', { lastName: '' }, 'lastName'],
      ['whitespace lastName', { lastName: '   ' }, 'lastName'],
    ] as const)('rejects %s', (_label, patch, expectedField) => {
      const result = validateUserCreateInput({ ...validInput, ...patch });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe(expectedField);
      }
    });

    test('rejects an unknown role', () => {
      const result = validateUserCreateInput({
        ...validInput,
        role: 'NOT_A_REAL_ROLE',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('role');
      }
    });

    test('rejects empty loginMethods', () => {
      const result = validateUserCreateInput({
        ...validInput,
        loginMethods: [],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('loginMethods');
      }
    });

    test('rejects unknown loginMethods entry', () => {
      const result = validateUserCreateInput({
        ...validInput,
        loginMethods: ['saml', 'oauth' as never],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('loginMethods');
      }
    });

    // Mirrors the DB `password_null_when_not_present` CHECK constraint.
    test("rejects password set but 'password' not in loginMethods", () => {
      const result = validateUserCreateInput({
        ...validInput,
        loginMethods: ['saml'],
        password: 'hashed',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('password');
      }
    });

    test("rejects 'password' in loginMethods without a password", () => {
      const result = validateUserCreateInput({
        ...validInput,
        loginMethods: ['password'],
        password: null,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('password');
      }
    });

    test("rejects empty-string password when 'password' in loginMethods", () => {
      const result = validateUserCreateInput({
        ...validInput,
        loginMethods: ['password'],
        password: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('password');
      }
    });
  });

  describe('validateUserUpdatePatch', () => {
    test('accepts an empty patch (all fields undefined)', () => {
      expect(validateUserUpdatePatch({})).toEqual({ ok: true });
    });

    test('accepts explicit-null fields (skip semantics for non-password)', () => {
      expect(
        validateUserUpdatePatch({
          email: null,
          firstName: null,
          lastName: null,
          role: null,
        }),
      ).toEqual({ ok: true });
    });

    test('accepts password: null (clears password)', () => {
      expect(validateUserUpdatePatch({ password: null })).toEqual({ ok: true });
    });

    test('rejects password: "" (shape error)', () => {
      const result = validateUserUpdatePatch({ password: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('password');
      }
    });

    test('rejects empty / whitespace firstName / lastName', () => {
      expect(validateUserUpdatePatch({ firstName: '' }).ok).toBe(false);
      expect(validateUserUpdatePatch({ firstName: '   ' }).ok).toBe(false);
      expect(validateUserUpdatePatch({ lastName: '' }).ok).toBe(false);
      expect(validateUserUpdatePatch({ lastName: '   ' }).ok).toBe(false);
    });

    test('rejects malformed email', () => {
      const result = validateUserUpdatePatch({ email: 'not-an-email' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('email');
      }
    });

    test('rejects unknown role', () => {
      const result = validateUserUpdatePatch({ role: 'NOT_A_REAL_ROLE' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('role');
      }
    });
  });
});
