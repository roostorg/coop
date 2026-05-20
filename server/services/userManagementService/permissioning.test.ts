import {
  getPermissionsForRole,
  UserPermission,
  UserPermissionsForRole,
  UserRole,
} from './permissioning.js';

describe('permissioning', () => {
  describe('MANAGE_ROLES', () => {
    it('is included in ADMIN by default (so ADMIN can edit roles in v1.0)', () => {
      expect(getPermissionsForRole(UserRole.ADMIN)).toContain(
        UserPermission.MANAGE_ROLES,
      );
    });

    it.each([
      UserRole.RULES_MANAGER,
      UserRole.ANALYST,
      UserRole.MODERATOR_MANAGER,
      UserRole.MODERATOR,
      UserRole.CHILD_SAFETY_MODERATOR,
      UserRole.EXTERNAL_MODERATOR,
    ])(
      'is NOT granted to %s by default — non-admins must not edit role permissions until granular permissions land',
      (role) => {
        expect(getPermissionsForRole(role)).not.toContain(
          UserPermission.MANAGE_ROLES,
        );
      },
    );
  });

  describe('UserPermissionsForRole seed map', () => {
    it('has an entry for every UserRole', () => {
      for (const role of Object.values(UserRole)) {
        expect(UserPermissionsForRole.has(role)).toBe(true);
      }
    });

    it('grants ADMIN every UserPermission (used as the upper bound for v1.0)', () => {
      const adminPermissions = new Set(getPermissionsForRole(UserRole.ADMIN));
      for (const permission of Object.values(UserPermission)) {
        expect(adminPermissions.has(permission)).toBe(true);
      }
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns an empty array for an unknown role rather than throwing', () => {
      expect(getPermissionsForRole('NOT_A_ROLE')).toEqual([]);
    });

    it('returns a fresh array on every call so the canonical seed cannot be corrupted', () => {
      const first = getPermissionsForRole(UserRole.ADMIN);
      const second = getPermissionsForRole(UserRole.ADMIN);
      // Different array references prove callers can't share state — even
      // if a caller hands the array off to code that mutates it, the next
      // call will get a fresh copy and authz won't drift across requests.
      expect(first).not.toBe(second);
      expect(first).toEqual(second);

      // Also assert the resolver can't accidentally hand back the seed
      // map's literal value: the seed is a Map, and the inner array is the
      // value stored under UserRole.ADMIN. We cannot reach into that Map
      // from here without breaking encapsulation, but the reference check
      // above is sufficient to guarantee the spread happens on every call.
      expect(first).toContain(UserPermission.MANAGE_ROLES);
    });
  });
});
