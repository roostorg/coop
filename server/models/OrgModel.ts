import sequelize, {
  type CreationOptional,
  type HasManyGetAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { UserPenaltySeverity } from '../services/moderationConfigService/index.js';
import { validateUrl } from '../utils/url.js';
import { type LocationBank } from './banks/LocationBankModel.js';
import { type DataTypes } from './index.js';
import { type Policy } from './PolicyModel.js';
import { type SequelizeAction } from './rules/ActionModel.js';
import { type Rule } from './rules/RuleModel.js';
import { type User } from './UserModel.js';

const { Model } = sequelize;

export type Org = InstanceType<ReturnType<typeof makeOrgModel>>;
export type PolicyActionPenalties = {
  actionId: string;
  policyId: string;
  penalties: number[];
};

/**
 * Data Model for Organizations
 */
export default function makeOrgModel(
  sequelize: Sequelize,
  DataTypes: DataTypes,
) {
  class Org extends Model<
    InferAttributes<Org, { omit: 'createdAt' | 'updatedAt' }>,
    InferCreationAttributes<Org, { omit: 'createdAt' | 'updatedAt' }>
  > {
    public declare id: string;
    public declare email: string;
    public declare name: string;
    public declare websiteUrl: string;
    public declare apiKeyId?: CreationOptional<string>;
    public declare onCallAlertEmail?: CreationOptional<string>;

    public declare getRules: HasManyGetAssociationsMixin<Rule>;
    public declare getActions: HasManyGetAssociationsMixin<SequelizeAction>;
    // Has to use any below to avoid circular type errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public declare getContentTypes: HasManyGetAssociationsMixin<any>;
    public declare getLocationBanks: HasManyGetAssociationsMixin<LocationBank>;
    public declare getUsers: HasManyGetAssociationsMixin<User>;
    public declare getPolicies: HasManyGetAssociationsMixin<Policy>;
    public declare createdAt: Date;
    public declare updatedAt: Date;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      Org.hasMany(models.User, { as: 'Users' });
      Org.hasMany(models.Rule, { as: 'Rules' });
      Org.hasMany(models.Action, { as: 'Actions', foreignKey: 'orgId' });
      Org.hasMany(models.ItemType, { as: 'ContentTypes' });
      Org.hasMany(models.LocationBank, { as: 'LocationBanks' });
      Org.hasMany(models.Policy, { as: 'policies' });
    }

    static async getPolicyActionPenaltiesEventuallyConsistent(orgId: string) {
      const [actions, policies] = await Promise.all([
        sequelize.models.Action.findAll({ where: { orgId } }),
        sequelize.models.Policy.findAll({ where: { orgId } }),
      ]);

      return (policies as Policy[]).flatMap((policy) =>
        (actions as SequelizeAction[]).map(
          (action): PolicyActionPenalties => ({
            actionId: action.id,
            policyId: policy.id,
            penalties: [
              computeActionPolicyPenalty(action.penalty, policy.penalty),
            ],
          }),
        ),
      );
    }
  }

  /* Fields */
  Org.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      websiteUrl: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isValidUrl: validateUrl,
        },
      },
      // ID of the AWS API Key resource that stores the API key. Not actually
      // used for anything at the moment (instead, the API key is looked up in
      // but potentially useful.
      apiKeyId: {
        type: DataTypes.STRING,
      },
      onCallAlertEmail: {
        type: DataTypes.STRING,
        validate: {
          isEmail: true,
        },
      },
    },
    {
      sequelize,
      modelName: 'org',
      underscored: true,
    },
  );

  return Org;
}

/**
 * Computes the severity of the penalty we should apply for a given
 * (action, policy) pair. The general idea is to make the penalties
 * increase exponentially as severity levels increase, but the rate
 * of increase can't be so high that a (severe, severe) penalty is
 * 50x higher than a (high, high) penalty.
 *
 * The easiest way to achieve this exponential behavior is at the individual
 * severity levels, rather than trying to multiply the action penalty
 * by the severity penalty to compound their magnitudes. So the severity
 * levels apply penalty magnitudes as follows:
 *
 * NONE = 0
 * LOW = 1
 * MEDIUM = 3
 * HIGH = 9
 * SEVERE = 27
 *
 * To get the penalty value for an (action, policy) pair, we just add the
 * penalty values of the action and penalty because the exponential nature
 * of these penalties has already been taken into account.
 */
function computeActionPolicyPenalty(
  actionPenalty: UserPenaltySeverity,
  policyPenalty: UserPenaltySeverity,
) {
  // Type annotation makes sure that every possible severity has a score.
  const penaltySeverityMap: { [k in UserPenaltySeverity]: number } = {
    [UserPenaltySeverity.NONE]: 0,
    [UserPenaltySeverity.LOW]: 1,
    [UserPenaltySeverity.MEDIUM]: 3,
    [UserPenaltySeverity.HIGH]: 9,
    [UserPenaltySeverity.SEVERE]: 27,
  };

  // If the action has no penalty (e.g., "Send to Moderation", "Restore
  // Content"), we never apply any penalty, regardless of the policy penalty.
  // Otherwise, the penalty accounts for both the action + policy penalties.
  return actionPenalty === UserPenaltySeverity.NONE
    ? 0
    : penaltySeverityMap[actionPenalty] + penaltySeverityMap[policyPenalty];
}
