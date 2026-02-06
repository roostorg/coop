import { makeEnumLike } from '@roostorg/types';

export const UserPenaltySeverity = makeEnumLike([
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'SEVERE',
]);
export type UserPenaltySeverity = keyof typeof UserPenaltySeverity;
