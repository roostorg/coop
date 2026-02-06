import { safeGet } from '../utils/misc.js';

export function isUniqueConstraintError(error: unknown): boolean {
  return safeGet(error, ['name']) === 'SequelizeUniqueConstraintError';
}

export function isEmptyResultSetError(error: unknown): boolean {
  return safeGet(error, ['name']) === 'SequelizeEmptyResultError';
}
