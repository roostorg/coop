import {
  validateOrgCreateInput,
  validateOrgUpdatePatch,
} from './orgValidation.js';

describe('orgValidation', () => {
  describe('validateOrgCreateInput', () => {
    const validInput = {
      name: 'Acme',
      email: 'ops@acme.example.com',
      websiteUrl: 'https://acme.example.com',
    };

    test('accepts a fully valid input', () => {
      expect(validateOrgCreateInput(validInput)).toEqual({ ok: true });
    });

    test('accepts a valid optional onCallAlertEmail', () => {
      expect(
        validateOrgCreateInput({
          ...validInput,
          onCallAlertEmail: 'oncall@acme.example.com',
        }),
      ).toEqual({ ok: true });
    });

    test.each([
      ['empty', ''],
      ['whitespace only', '   '],
    ])('rejects name that is %s', (_label, name) => {
      const result = validateOrgCreateInput({ ...validInput, name });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('name');
      }
    });

    test.each([
      ['empty', ''],
      ['missing @', 'not-an-email'],
      ['missing domain', 'foo@'],
      ['missing tld', 'foo@bar'],
      ['contains space', 'foo @bar.com'],
    ])('rejects email that is %s', (_label, email) => {
      const result = validateOrgCreateInput({ ...validInput, email });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('email');
      }
    });

    test.each([
      ['empty', ''],
      ['not a URL', 'definitely not a url'],
      // eslint-disable-next-line no-script-url
      ['javascript scheme', 'javascript:alert(1)'],
      ['ftp scheme', 'ftp://acme.example.com'],
    ])('rejects websiteUrl that is %s', (_label, websiteUrl) => {
      const result = validateOrgCreateInput({ ...validInput, websiteUrl });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('websiteUrl');
      }
    });

    test('rejects invalid onCallAlertEmail when provided', () => {
      const result = validateOrgCreateInput({
        ...validInput,
        onCallAlertEmail: 'not-an-email',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('onCallAlertEmail');
      }
    });

    test('accepts onCallAlertEmail that is null or empty (optional)', () => {
      expect(
        validateOrgCreateInput({ ...validInput, onCallAlertEmail: null }),
      ).toEqual({ ok: true });
      expect(
        validateOrgCreateInput({ ...validInput, onCallAlertEmail: '' }),
      ).toEqual({ ok: true });
    });
  });

  describe('validateOrgUpdatePatch', () => {
    test('accepts an empty patch (all fields undefined)', () => {
      expect(validateOrgUpdatePatch({})).toEqual({ ok: true });
    });

    test('accepts explicit-null fields (skip / clear semantics)', () => {
      expect(
        validateOrgUpdatePatch({
          name: null,
          email: null,
          websiteUrl: null,
          onCallAlertEmail: null,
        }),
      ).toEqual({ ok: true });
    });

    test('accepts empty-string websiteUrl (Sequelize parity: treated as skip)', () => {
      expect(validateOrgUpdatePatch({ websiteUrl: '' })).toEqual({ ok: true });
    });

    test('rejects empty / whitespace name', () => {
      expect(validateOrgUpdatePatch({ name: '' }).ok).toBe(false);
      expect(validateOrgUpdatePatch({ name: '   ' }).ok).toBe(false);
    });

    test('rejects malformed email', () => {
      const result = validateOrgUpdatePatch({ email: 'not-an-email' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('email');
      }
    });

    test('rejects malformed websiteUrl', () => {
      const result = validateOrgUpdatePatch({
        // eslint-disable-next-line no-script-url
        websiteUrl: 'javascript:alert(1)',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('websiteUrl');
      }
    });

    test('rejects malformed onCallAlertEmail (non-null string)', () => {
      const result = validateOrgUpdatePatch({ onCallAlertEmail: 'nope' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.field).toBe('onCallAlertEmail');
      }
    });
  });
});
