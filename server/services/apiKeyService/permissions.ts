export const API_KEY_PERMISSIONS = [
  {
    value: 'items:read',
    description: 'Read items, derived data, and user scores.',
  },
  { value: 'items:write', description: 'Ingest and evaluate items.' },
  { value: 'reports:write', description: 'Submit reports.' },
  { value: 'appeals:write', description: 'Submit appeals.' },
  { value: 'actions:execute', description: 'Execute actions.' },
  {
    value: 'config:read',
    description: 'Read action definitions, item types, and policies.',
  },
  { value: 'config:write', description: 'Create and update definitions.' },
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number]['value'];
