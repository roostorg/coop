import { type ItemTypeKind } from '@roostorg/types';
import { type Generated, type GeneratedAlways } from 'kysely';
import { type JsonObject } from 'type-fest';

import { type TaggedUnionFromCases } from '../../utils/typescript-types.js';
import { type ActionType } from './types/actions.js';
import { type ItemSchema } from './types/itemTypes.js';
import type { PolicyType } from './types/policies.js';
import {
  type ConditionSet,
  type RuleAlarmStatus,
  type RuleStatus,
  type RuleType,
} from './types/rules.js';
import { type UserPenaltySeverity } from './types/shared.js';

export type ModerationConfigServicePg = {
  'public.item_types': {
    id: Generated<string>;
    name: string;
    description: string | null;
    org_id: string;
    created_at: GeneratedAlways<Date>;
    kind: ItemTypeKind;
    fields: ItemSchema;
    is_default_user: Generated<boolean>;
    display_name_field: string | null;
    creator_id_field: string | null;
    thread_id_field: string | null;
    parent_id_field: string | null;
    created_at_field: string | null;
    profile_icon_field: string | null;
    background_image_field: string | null;
    is_deleted_field: string | null;
  };
  // TODO: redefine as a union to capture the correlation of the nulls,
  // then leverage FixKyselyRowCorrelation in the ItemTypesDbResult type.
  // This'll make the typing (including for our tests) a bit more accurate.
  'public.item_type_versions': {
    id: GeneratedAlways<string>;
    name: GeneratedAlways<string>;
    description: GeneratedAlways<string | null>;
    org_id: GeneratedAlways<string>;
    created_at: GeneratedAlways<Date>;
    kind: GeneratedAlways<ItemTypeKind>;
    fields: GeneratedAlways<ItemSchema>;
    is_default_user: GeneratedAlways<boolean>;
    display_name_field: GeneratedAlways<string | null>;
    creator_id_field: GeneratedAlways<string | null>;
    thread_id_field: GeneratedAlways<string | null>;
    parent_id_field: GeneratedAlways<string | null>;
    created_at_field: GeneratedAlways<string | null>;
    profile_icon_field: GeneratedAlways<string | null>;
    background_image_field: GeneratedAlways<string | null>;
    is_deleted_field: GeneratedAlways<string | null>;
    version: GeneratedAlways<string>;
    is_current: GeneratedAlways<boolean>;
  };
  'public.rules_and_item_types': {
    rule_id: string;
    item_type_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
  };
  'public.actions_and_item_types': {
    action_id: string;
    item_type_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    sys_period: GeneratedAlways<unknown>;
  };
  'public.actions': {
    id: string;
    org_id: string;
    name: string;
    description: string | null;
    penalty: UserPenaltySeverity;
    // TODO: while we expect these to be null if the action type is not
    // CUSTOM_ACTION, and won't return them from the moderation config
    // service, the db doesn't actually enforce that.
    callback_url_headers: JsonObject | null;
    callback_url_body: JsonObject | null;
    // TODO: when we move updates to the moderation config service, figure out
    // whether to set `updated_at` on update or whether to just drop the column,
    // given the challenge of inerpreting the `updated_at` column on an entity
    // that has part of its data in other tables (e.g., should we update the
    // action's updated_at when we update its set of item types?) 
    created_at: GeneratedAlways<Date>;
    updated_at: Generated<Date>;
    applies_to_all_items_of_kind: Generated<ItemTypeKind[]>;
    apply_user_strikes: boolean;
  } & TaggedUnionFromCases<
    { action_type: ActionType },
    {
      CUSTOM_ACTION: { callback_url: string };
      ENQUEUE_TO_NCMEC: { callback_url: null };
      ENQUEUE_TO_MRT: { callback_url: null };
      ENQUEUE_AUTHOR_TO_MRT: { callback_url: null };
      REJECT_APPEAL: { callback_url: null };
      ACCEPT_APPEAL: { callback_url: null };
    }
  >;
  'public.rules': {
    id: string;
    name: string;
    status_if_unexpired: RuleStatus;
    tags: string[];
    max_daily_actions: number | null;
    daily_actions_run: number;
    last_action_date: string | null;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    org_id: string;
    creator_id: string;
    expiration_time: Date | null;
    condition_set: ConditionSet;
    alarm_status: Generated<RuleAlarmStatus>;
    alarm_status_set_at: Generated<Date>;
    rule_type: RuleType;
  };
  'public.policies': {
    id: string;
    name: string;
    org_id: string;
    parent_id: string | null;
    created_at: GeneratedAlways<Date>;
    updated_at: Date;
    policy_text: string | null;
    enforcement_guidelines: string | null;
    penalty: UserPenaltySeverity;
    sys_period: GeneratedAlways<unknown>;
    semantic_version: number;
    policy_type: PolicyType | null;
    user_strike_count: Generated<number>;
    apply_user_strike_count_config_to_children: Generated<boolean>;
  };
  'public.user_strike_thresholds': {
    id: GeneratedAlways<string>;
    org_id: string;
    threshold: number;
    actions: string[];
  };
  'public.text_banks': {
    id: string;
    name: string;
    description: string | null;
    org_id: string;
    created_at: GeneratedAlways<Date>;
    updated_at: Date;
    owner_id: string | null;
    type: 'STRING' | 'REGEX';
    strings: string[];
  };
};
