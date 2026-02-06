import { type ScalarType, type TaggedScalar } from '@roostorg/types';
import _ from 'lodash';
import sequelize, {
  Sequelize,
  type CreationOptional,
  type HasManyGetAssociationsMixin,
  type HasManySetAssociationsMixin,
  type HasOneGetAssociationMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from 'sequelize';

import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
  type ConditionSet,
  type LeafCondition,
} from '../../services/moderationConfigService/index.js';
import { type SerializableError } from '../../utils/errors.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import {
  type NonEmptyArray,
  type WithUndefined,
} from '../../utils/typescript-types.js';
import { type DataTypes } from '../index.js';
import { type User } from '../UserModel.js';
import { type SequelizeAction } from './ActionModel.js';
import { type TaggedItemData } from './item-type-fields.js';
import { type RuleLatestVersion } from './RuleLatestVersionModel.js';

const { Model, Op } = sequelize;
const { without } = _;

export type Rule = InstanceType<ReturnType<typeof makeRuleModel>>;
export type RuleWithLatestVersion = Rule &
  Required<Pick<Rule, 'latestVersion'>>;

export enum ConditionCompletionOutcome {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  INAPPLICABLE = 'INAPPLICABLE',
}

// We might add more kinds of errors here later...
export enum ConditionFailureOutcome {
  ERRORED = 'ERRORED',
}

export type ConditionOutcome =
  | ConditionCompletionOutcome
  | ConditionFailureOutcome;

// NB: For legacy reasons, score is stored as a string and matchingValue holds
// only a single string value. In the future, its easy to imagine condition
// completions having much richer metadata, which could vary by signal type.
export type ConditionCompletionMetadata = {
  score?: string;
  matchedValue?: string;
};

export type ConditionFailureMetadata = {
  error?: SerializableError;
};

type ConditionResultCommonMetadata = {
  signalInputValues?: (TaggedScalar<ScalarType> | TaggedItemData)[];
};

// A completion outcome can have optional metadata about the signal's score etc,
// while a failure outcome can have an error. In a completion outcome, the
// failure metadata must be undefined (except in IS_UNAVAILABLE comparisons),
// and vice-versa.
// prettier-ignore
export type ConditionResult =
  | ({ outcome: ConditionCompletionOutcome }
        & ConditionCompletionMetadata
        // Conditions that completed successfully can optionally have
        // some of the failure metadata (for now just the `error`) if the
        // condition used a signal result IS_UNAVAILABLE comparison.
        & Partial<Pick<ConditionFailureMetadata, 'error'>>
        & ConditionResultCommonMetadata)
  | ({ outcome: ConditionFailureOutcome; }
        & ConditionFailureMetadata
        // Failed condition must not have completion data
        & WithUndefined<ConditionCompletionMetadata>
        & ConditionResultCommonMetadata)

export type ConditionWithResult =
  | LeafConditionWithResult
  | ConditionSetWithResult;

export type ConditionSetWithResult = Omit<ConditionSet, 'conditions'> & {
  conditions:
    | NonEmptyArray<LeafConditionWithResult>
    | NonEmptyArray<ConditionSetWithResult>;
  result?: ConditionResult;
};

// A useful type for logging. Gives us the result of the condition,
// with the context (i.e., the Condition definition) to interpret that result.
// The result is still optional because the conditions execution can be skipped
// if the result of a parent condition can be determined without running the
// child condition. Just leaving out the result property in that case is a very
// nice way to model "skipped", because it means that the original condition
// object can be used as a ConditionWithResult in that case.
export type LeafConditionWithResult = LeafCondition & {
  result?: ConditionResult;
};

/**
 * Data Model for Rules. Rules are comprised of
 * ContentType inputs, Conditions, and Actions.
 */
const makeRuleModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class Rule extends Model<
    InferAttributes<Rule, { omit: 'createdAt' | 'updatedAt' }>,
    InferCreationAttributes<Rule, { omit: 'createdAt' | 'updatedAt' }>
  > {
    public declare id: string;
    public declare name: string;
    public declare description?: string | null;
    public declare expirationTime?: Date | null;
    public declare statusIfUnexpired: CreationOptional<
      Exclude<RuleStatus, typeof RuleStatus.EXPIRED>
    >;
    public declare lastActionDate: string | null;
    public declare maxDailyActions: number | null;
    public declare dailyActionsRun: CreationOptional<number>;
    public declare status: RuleStatus;

    public declare orgId: string;
    public declare creatorId: string;
    public declare tags: string[];
    public declare conditionSet: ConditionSet;
    public declare ruleType: RuleType;

    public declare alarmStatus: CreationOptional<RuleAlarmStatus>;
    public declare alarmStatusSetAt: CreationOptional<Date>;

    public declare getActions: HasManyGetAssociationsMixin<SequelizeAction>;
    public declare setActions: HasManySetAssociationsMixin<
      SequelizeAction,
      string
    >;

    // Have to use any below to avoid circular type errors
    /* eslint-disable @typescript-eslint/no-explicit-any */
    public declare getContentTypes: HasManyGetAssociationsMixin<any>;
    public declare setContentTypes: HasManySetAssociationsMixin<any, string>;

    public declare getPolicies: HasManyGetAssociationsMixin<any>;
    public declare setPolicies: HasManySetAssociationsMixin<any, string>;

    public declare getBacktests: HasManyGetAssociationsMixin<any>;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    public declare getCreator: HasOneGetAssociationMixin<User>;

    public declare getLatestVersion: HasOneGetAssociationMixin<RuleLatestVersion>;
    public declare latestVersion?: NonAttribute<RuleLatestVersion>;

    public declare createdAt: Date;
    public declare updatedAt: Date;

    public declare parentId?: string | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      Rule.belongsTo(models.Org, { as: 'Org', foreignKey: 'orgId' });
      Rule.belongsTo(models.User, { as: 'Creator', foreignKey: 'creatorId' });
      Rule.belongsToMany(models.ItemType, {
        through: 'rules_and_item_types',
        as: 'contentTypes',
        otherKey: 'item_type_id',
      });
      Rule.belongsToMany(models.Action, {
        through: 'rules_and_actions',
        as: 'Actions',
      });
      Rule.belongsToMany(models.Policy, {
        through: 'rules_and_policies',
        as: 'Policies',
      });
      Rule.hasMany(models.Backtest, { as: 'Backtests' });
      Rule.hasOne(models.RuleLatestVersion, {
        as: 'latestVersion',
        foreignKey: 'ruleId',
      });
    }

    /**
     * Finds all enabled rules that are not associated with any content types.
     * We call these "user rules" (or "pure user rules") because their input is
     * solely data about a user -- rather than any content submission.
     */
    static async findEnabledUserRules(): Promise<RuleWithLatestVersion[]> {
      return Rule.sequelize!.transaction(async (t) => {
        return Rule.scope('enabled').findAll({
          where: { ruleType: RuleType.USER },
          include: ['latestVersion'],
          transaction: t,
        }) as Promise<RuleWithLatestVersion[]>;
      });
    }
  }

  /* Fields */
  Rule.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      orgId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      creatorId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      // Name of the Rule -- this must be unique for each Org (i.e. an Org can't
      // have two Rules with the same name)
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      statusIfUnexpired: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: RuleStatus.DRAFT,
        validate: {
          notEmpty: true,
          isIn: [without(Object.values(RuleStatus), RuleStatus.EXPIRED)],
        },
      },
      status: {
        type: DataTypes.VIRTUAL(DataTypes.STRING, [
          'statusIfUnexpired',
          'expirationTime',
        ]),
        get() {
          const { expirationTime, statusIfUnexpired } = this;
          return expirationTime && expirationTime.valueOf() < Date.now()
            ? RuleStatus.EXPIRED
            : statusIfUnexpired;
        },
        set(value: RuleStatus) {
          const expirationTime = this.expirationTime;
          if (value === RuleStatus.EXPIRED) {
            this.expirationTime = expirationTime
              ? new Date(Math.max(expirationTime.valueOf(), Date.now()))
              : new Date();
          } else {
            this.statusIfUnexpired = value;
          }
        },
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      /**
       * Maximum number of times this rule's actions can apply per day.
       * Useful for slowly rolling out rules. The field name is a bit of a
       * misnomer, in that it doesn't record the maximum _number of actions_
       * that a rule can trigger in a day, but rather the maximum _number of
       * times_ all of the rule's actions can be triggered.
       *
       * NB: we use DataTypes.INTEGER (which is an int32), rather than BIGINT
       * (which is an int64) so that the value can be represented as a JS Number,
       * without us having to parse it to a bigint. int32 supports > 2 billion
       * positive values, so this should be enough lol.
       */
      maxDailyActions: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /**
       * The number of times this rule's actions were run in the most recent day
       * when this rule's actions actually ran. That date is stored in
       * lastActionDate. This field is used to enforce maxDailyActions.
       */
      dailyActionsRun: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      /**
       * The last date when this rule's actions were run. This is used
       * to enforce maxDailyActions.
       */
      lastActionDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      expirationTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      conditionSet: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      ruleType: { type: DataTypes.STRING, allowNull: false },
      alarmStatus: {
        type: DataTypes.STRING,
        validate: {
          isIn: [Object.values(RuleAlarmStatus)],
        },
        defaultValue: RuleAlarmStatus.INSUFFICIENT_DATA,
        allowNull: false,
      },
      alarmStatusSetAt: {
        type: DataTypes.DATE,
        defaultValue: new Date(),
        allowNull: false,
      },
      parentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'rule',
      underscored: true,
      tableName: 'rules',
    },
  );

  /**
   * A scope for finding "enabled rules", where an an enabled rule is one that
   * we'd run if a new piece of content (of one of the rule's content types)
   * is submitted, or that we'd run against a user in the next user rule run.
   *
   * "Running the rule" just means checking if its conditions pass on the
   * content; whether we'd run the actions of each passing rule is a different
   * question.
   *
   * This function is _highly_ impure. Its results will change as rules
   * expire, or as daily limits on rules are reached, among other things.
   */
  Rule.addScope('enabled', () => ({
    // NB: this where query is brittle because it hardcodes the column name
    // (max_daily_actions) for the maxDailyActions attribute of the Rule model.
    // This hardcoding costs us type safety (once we set it up for sequelize)
    // and automatic refactoring and makes it harder to find all uses of the
    // attribute, so it's very bug-prone. But it seems to be the only thing
    // that Sequelize supports for comparing two columns in a WHERE clause?!?!
    // Meanwhile, we put `rule.max_daily_actions`, not just `max_daily_actions`,
    // to make sure we get the right field, but this makes us reliant on even
    // more details of the final query that we shouldn't have to know about.
    where: {
      // Keep rules that don't expire or haven't expired yet.
      expirationTime: { [Op.or]: [null, { [Op.gt]: Sequelize.fn('now') }] },
      // And are in an enabled status.
      statusIfUnexpired: { [Op.or]: [RuleStatus.LIVE, RuleStatus.BACKGROUND] },
      // And either don't have a daily actions quota, haven't run yet
      // today (in which case they can't have exceeded the quota and the
      // value in dailyActionsRun refers to a prior day), or have run
      // today, but fewer times than their quota.
      [Op.or]: [
        { maxDailyActions: null },
        { lastActionDate: { [Op.ne]: getUtcDateOnlyString() } },
        {
          dailyActionsRun: { [Op.lt]: { [Op.col]: 'rule.max_daily_actions' } },
        },
      ],
    },
  }));

  return Rule;
};

export default makeRuleModel;
