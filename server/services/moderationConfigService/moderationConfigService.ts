/* eslint-disable max-lines */
import { type ConsumerDirectives } from '../../lib/cache/index.js';
import { type Kysely } from 'kysely';
import _ from 'lodash';
import { type JsonObject, type ReadonlyDeep } from 'type-fest';

// eslint-disable-next-line import/no-restricted-paths
import type { Invoker } from '../../models/types/permissioning.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { __throw } from '../../utils/misc.js';
import { type ModerationConfigServicePg } from './dbTypes.js';
import { type Action, type Policy } from './index.js';
import ActionOperations, {
  type ActionErrorType,
} from './modules/ActionOperations.js';
import ItemTypeOperations from './modules/ItemTypeOperations.js';
import MatchingBankOperations, {
  type MatchingBankErrorType,
} from './modules/MatchingBankOperations.js';
import PolicyOperations, {
  type PolicyErrorType,
} from './modules/PolicyOperations.js';
import UserStrikeOperations, {
  type UserStrikeThresholdErrorType,
} from './modules/UserStrikeOperations.js';
import {
  type ContentItemType,
  type ItemSchema,
  type ItemType,
  type ItemTypeKind,
  type ItemTypeSelector,
  type ThreadItemType,
  type UserItemType,
} from './types/itemTypes.js';
import type { PolicyType } from './types/policies.js';

export type ModerationConfigErrorType =
  | 'AttemptingToDeleteDefaultUserType'
  | ActionErrorType
  | PolicyErrorType
  | UserStrikeThresholdErrorType
  | RuleErrorType
  | LocationBankErrorType
  | MatchingBankErrorType;

// By having the ModerationConfigService `implement` this type, TS will check
// for us that every ModerationConfigService method returns one of our public
// types.
type ReturnsModerationConfigTypes = {
  [K in keyof ModerationConfigService]: ReturnType<
    ModerationConfigService[K]
  > extends ArrayOrPromiseOf<void | ItemType | Action | Policy | boolean>
    ? ModerationConfigService[K]
    : never;
};

type ArrayOrPromiseOf<T> =
  | ReadonlyDeep<T>
  | readonly ReadonlyDeep<T>[]
  | Promise<readonly ReadonlyDeep<T>[]>
  | Promise<ReadonlyDeep<T>>;

/**
 * This service will eventually manage all CRUD operations on entities that are
 * part of an organization's defined moderation policy, including: rules,
 * actions, policies, item types, and banks — basically, everything in an org
 * except for the org’s users (which are fairly disconnected).
 *
 * The scope of this service is intentionally very broad, and it should not be
 * sub-divided lightly; see the rationale at
 * https://coop.atlassian.net/browse/COOP-743?focusedCommentId=10223
 */
export class ModerationConfigService implements ReturnsModerationConfigTypes {
  private readonly actionOps: ActionOperations;
  private readonly policyOps: PolicyOperations;
  private readonly itemTypeOps: ItemTypeOperations;
  private readonly userStrikeOps: UserStrikeOperations;
  private readonly matchingBankOps: MatchingBankOperations;

  constructor(
    pgQuery: Kysely<ModerationConfigServicePg>,
    pgQueryReplica: Kysely<ModerationConfigServicePg>,
    private readonly onDeletePolicyId: (opts: {
      policyId: string;
      orgId: string;
    }) => Promise<void>,
  ) {
    this.actionOps = new ActionOperations(pgQuery, pgQueryReplica);
    this.policyOps = new PolicyOperations(
      pgQuery,
      pgQueryReplica,
      onDeletePolicyId,
    );
    this.itemTypeOps = new ItemTypeOperations(pgQuery, pgQueryReplica);
    // TODO: Remove Rule API and replace with kysely
    this.userStrikeOps = new UserStrikeOperations(pgQuery, pgQueryReplica);
    this.matchingBankOps = new MatchingBankOperations(pgQuery, pgQueryReplica);
  }

  async getItemTypes(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }): Promise<readonly ReadonlyDeep<ItemType>[]> {
    return this.itemTypeOps.getItemTypes(opts);
  }

  async getItemType(opts: {
    orgId: string;
    itemTypeSelector: ItemTypeSelector;
    directives?: ConsumerDirectives;
  }) {
    return this.itemTypeOps.getItemType(opts);
  }

  async getItemTypesByKind<T extends ItemTypeKind>(opts: {
    orgId: string;
    kind: T;
    directives?: ConsumerDirectives;
  }): Promise<readonly ReadonlyDeep<ItemType & { kind: T }>[]> {
    return this.itemTypeOps.getItemTypesByKind(opts);
  }

  async getDefaultUserType(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }) {
    return this.itemTypeOps.getDefaultUserType(opts);
  }

  async createDefaultUserType(orgId: string) {
    return this.itemTypeOps.createDefaultUserType(orgId);
  }

  async createContentType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        creatorId?: string | null;
        threadId?: string | null;
        parentId?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<ContentItemType>> {
    return this.itemTypeOps.createContentType(orgId, input);
  }

  async updateContentType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        creatorId?: string | null;
        threadId?: string | null;
        parentId?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<ContentItemType>> {
    return this.itemTypeOps.updateContentType(orgId, input);
  }

  async createThreadType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        createdAt?: string | null;
        displayName?: string | null;
        creatorId?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<ThreadItemType>> {
    return this.itemTypeOps.createThreadType(orgId, input);
  }

  async updateThreadType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        createdAt?: string | null;
        displayName?: string | null;
        creatorId?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<ThreadItemType>> {
    return this.itemTypeOps.updateThreadType(orgId, input);
  }

  async createUserType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        profileIcon?: string | null;
        backgroundImage?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<UserItemType>> {
    return this.itemTypeOps.createUserType(orgId, input);
  }

  async updateUserType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        profileIcon?: string | null;
        backgroundImage?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
      };
    },
  ): Promise<ReadonlyDeep<UserItemType>> {
    return this.itemTypeOps.updateUserType(orgId, input);
  }

  async deleteItemType(opts: { orgId: string; itemTypeId: string }) {
    return this.itemTypeOps.deleteItemType(opts);
  }

  async getItemTypesForAction(opts: {
    orgId: string;
    actionId: string;
    directives?: ConsumerDirectives;
  }): Promise<ItemType[]> {
    return this.itemTypeOps.getItemTypesForAction(opts);
  }

  async getItemTypesForRule(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<ItemType[]> {
    return this.itemTypeOps.getItemTypesForRule(opts);
  }

  async createAction(
    orgId: string,
    input: {
      name: string;
      description: string | null;
      // TODO: support other types? Need to figure out relationship between
      // activating various org settings (e.g., to enable MRT or NCMEC reporting)
      // and this moderationConfigService.
      type: 'CUSTOM_ACTION';
      callbackUrl: string;
      callbackUrlHeaders: JsonObject | null;
      callbackUrlBody: JsonObject | null;
      // TODO: linking specific item types not yet supported.
      applyUserStrikes?: boolean;
    },
  ) {
    return this.actionOps.createAction(orgId, input);
  }

  async getActions(opts: {
    orgId: string;
    ids?: readonly string[];
    readFromReplica?: boolean;
  }) {
    return this.actionOps.getActions(opts);
  }

  async getPolicies(opts: { orgId: string; readFromReplica?: boolean }) {
    return this.policyOps.getPolicies(opts);
  }

  async getPolicy(opts: {
    orgId: string;
    policyId: string;
    readFromReplica?: boolean;
  }) {
    return this.policyOps.getPolicy(opts);
  }

  async createPolicy(opts: {
    orgId: string;
    policy: {
      name: string;
      parentId: string | null;
      policyText: string | null;
      enforcementGuidelines: string | null;
      policyType: PolicyType | null;
    };
    invokedBy: Invoker;
  }): Promise<Policy> {
    return this.policyOps.createPolicy(opts);
  }

  async updatePolicy(opts: {
    orgId: string;
    policy: {
      id: string;
      name?: string;
      parentId?: string | null;
      policyText?: string | null;
      enforcementGuidelines?: string | null;
      policyType?: PolicyType | null;
      userStrikeCount?: number | null;
      applyUserStrikeCountConfigToChildren?: boolean | null;
    };
    invokedBy: Invoker;
  }): Promise<Policy> {
    return this.policyOps.updatePolicy(opts);
  }

  async deletePolicy(opts: {
    orgId: string;
    policyId: string;
    invokedBy: Invoker;
  }) {
    return this.policyOps.deletePolicy(opts);
  }

  async getUserStrikeThresholdsForOrg(orgId: string) {
    return this.userStrikeOps.getUserStrikeThresholds({
      orgId,
      readFromReplica: true,
    });
  }

  async createUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: {
      threshold: number;
      actions: string[];
    };
  }) {
    return this.userStrikeOps.createUserStrikeThreshold(opts);
  }

  async setAllUserStrikeThresholds(opts: {
    orgId: string;
    thresholds: readonly {
      threshold: number;
      actions: readonly string[];
    }[];
  }) {
    return this.userStrikeOps.setAllUserStrikeThresholds(opts);
  }

  async updateUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: { id: string; threshold?: number; actions?: string[] };
  }) {
    return this.userStrikeOps.updateUserStrikeThreshold(opts);
  }

  async deleteUserStrikeThreshold(opts: {
    orgId: string;

    thresholdSettings: { id: string; threshold: number };
  }) {
    return this.userStrikeOps.deleteUserStrikeThreshold({
      orgId: opts.orgId,
      id: opts.thresholdSettings.id,
      threshold: opts.thresholdSettings.threshold,
    });
  }

  async getTextBank(opts: {
    orgId: string;
    id: string;
    readFromReplica?: boolean;
  }) {
    return this.matchingBankOps.getTextBank(opts);
  }

  async getTextBanks(opts: { orgId: string; readFromReplica?: boolean }) {
    return this.matchingBankOps.getTextBanks(opts);
  }

  async createTextBank(
    orgId: string,
    input: {
      name: string;
      description: string | null;
      type: 'STRING' | 'REGEX';
      ownerId?: string | null;
      strings: string[];
    },
  ) {
    return this.matchingBankOps.createTextBank(orgId, input);
  }

  async updateTextBank(
    orgId: string,
    input: {
      id: string;
      name?: string;
      description?: string | null;
      type?: 'STRING' | 'REGEX';
      ownerId?: string | null;
      strings?: string[];
    },
  ) {
    return this.matchingBankOps.updateTextBank(orgId, input);
  }

  async deleteTextBank(orgId: string, id: string) {
    return this.matchingBankOps.deleteTextBank(orgId, id);
  }
  async close() {
    await this.itemTypeOps.close();
  }
}

type RuleErrorType =
  | 'RuleNameExistsError'
  | 'RuleHasRunningBacktestsError'
  | 'RuleIsMissingContentTypeError';

// TODO: throw this error as appropriate on failed rule creation/update.
export const makeRuleNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A rule with that name already exists in this organization.',
    name: 'RuleNameExistsError',
    ...data,
  });

// TODO: throw this error as appropriate on failed rule creation/update.
export const makeRuleIsMissingContentTypeError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'This rule must contain a content type on which to operate.',
    name: 'RuleIsMissingContentTypeError',
    ...data,
  });

// TODO: throw this error as appropriate on failed rule creation/update.
export const makeRuleHasRunningBacktestsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.AttemptingToMutateActiveRule],
    title:
      "This rule cannot be updated while it has running backtests, which are using the rule's current conditions.",
    name: 'RuleHasRunningBacktestsError',
    ...data,
  });

type LocationBankErrorType = 'LocationBankNameExistsError';

// TODO: throw this error as appropriate on failed bank creation/update.
export const makeLocationBankNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A location bank with this name already exists',
    name: 'LocationBankNameExistsError',
    ...data,
  });
