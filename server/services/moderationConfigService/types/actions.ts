// This type is intentionally more limited than the corresponding model,
// since this service should not have any dependencies on the model instances'

import { makeEnumLike } from '@roostorg/types';
import { type JsonObject, type ReadonlyDeep, type Simplify } from 'type-fest';

import { type TaggedUnionFromCases } from '../../../utils/typescript-types.js';

export const ActionType = makeEnumLike([
  'CUSTOM_ACTION',
  'ENQUEUE_TO_MRT',
  'ENQUEUE_TO_NCMEC',
  'ENQUEUE_AUTHOR_TO_MRT',
]);

export type ActionType = keyof typeof ActionType;

export type Action =
  | EnqueueToMrtAction
  | EnqueueToNcmecAction
  | CustomAction
  | EnqueueAuthorToMrtAction;

type AnyAction = ReadonlyDeep<
  Simplify<
    {
      id: string;
      orgId: string;
      name: string;
      applyUserStrikes: boolean;
    } & TaggedUnionFromCases<
      { actionType: ActionType },
      {
        ENQUEUE_TO_MRT: { callbackUrl?: null };
        ENQUEUE_TO_NCMEC: { callbackUrl?: null };
        ENQUEUE_AUTHOR_TO_MRT: { callbackUrl?: null };
        CUSTOM_ACTION: {
          callbackUrl: string;
          callbackUrlHeaders: JsonObject | null;
          callbackUrlBody: JsonObject | null;
          customMrtApiParams: JsonObject | null;
        };
      }
    >
  >
>;

export type EnqueueToMrtAction = Simplify<
  AnyAction & { readonly actionType: 'ENQUEUE_TO_MRT' }
>;

export type EnqueueToNcmecAction = Simplify<
  AnyAction & { readonly actionType: 'ENQUEUE_TO_NCMEC' }
>;

export type EnqueueAuthorToMrtAction = Simplify<
  AnyAction & { readonly actionType: 'ENQUEUE_AUTHOR_TO_MRT' }
>;

export type CustomAction = Simplify<
  AnyAction & { readonly actionType: 'CUSTOM_ACTION' }
>;
