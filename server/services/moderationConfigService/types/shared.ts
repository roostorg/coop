import { makeEnumLike } from '@roostorg/coop-types';

export const UserPenaltySeverity = makeEnumLike([
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'SEVERE',
]);
export type UserPenaltySeverity = keyof typeof UserPenaltySeverity;
