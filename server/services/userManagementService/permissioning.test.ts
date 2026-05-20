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
  });
});
