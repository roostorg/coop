import { makeEnumLike } from '@roostorg/types';

export const PolicyType = makeEnumLike([
  'HATE',
  'VIOLENCE',
  'HARRASSMENT',
  'SEXUAL_CONTENT',
  'SPAM',
  'DRUG_SALES',
  'WEAPON_SALES',
  'TERRORISM',
  'SEXUAL_EXPLOITATION',
  'SELF_HARM_AND_SUICIDE',
  'GROOMING',
  'PROFANITY',
  'PRIVACY',
  'FRAUD_AND_DECEPTION',
]);
export type PolicyType = keyof typeof PolicyType;

export type Policy = {
  id: string;
  name: string;
  orgId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  policyText: string | null;
  policyType: PolicyType | null;
  semanticVersion: number;
  userStrikeCount: number;
  applyUserStrikeCountConfigToChildren: boolean;
  penalty: string; // TODO: remove
};
