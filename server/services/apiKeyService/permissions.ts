export const API_KEY_PERMISSIONS = [
  'items:read',
  'items:write',
  'reports:write',
  'appeals:write',
  'actions:execute',
  'config:read',
  'config:write',
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

// Fixed compatibility grants, independent of additions to the permission list.
export const LEGACY_API_KEY_PERMISSIONS: readonly ApiKeyPermission[] = [
  'items:read',
  'items:write',
  'reports:write',
  'appeals:write',
  'actions:execute',
  'config:read',
];
