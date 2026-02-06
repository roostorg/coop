import _ from 'lodash';
import sequelize, {
  type BelongsToGetAssociationMixin,
  type HasManyAddAssociationsMixin,
  type HasManyGetAssociationsMixin,
  type HasManySetAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import {
  PolicyType,
  UserPenaltySeverity,
} from '../services/moderationConfigService/index.js';
import { type DataTypes } from './index.js';
import { type Rule } from './rules/RuleModel.js';

const { groupBy, mapValues } = _;
const { Model } = sequelize;

export type Policy = InstanceType<ReturnType<typeof makePolicy>>;

/**
 * Data Model for Policies. These policies can represent overall
 * policy areas (crime, safety) or more granular policy areas (e.g.
 * selling dangerous goods, child safety). Policies are constructed as
 * a tree - or rather, a set of trees, all of which can be thought of
 * as child trees under an abstract root node.
 *
 *                          ROOT
 *         |                  |                     |
 *       Crime              Safety                 Hate
 *    |        |         |         |          |             |
 * Weapons   Drugs    Children  Self-harm   Dehumanization  Threats
 *
 * Each node (except the root) is a policy.
 */
const makePolicy = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class Policy extends Model<
    InferAttributes<Policy>,
    InferCreationAttributes<Policy>
  > {
    public declare id: string;
    public declare name: string;
    public declare policyText?: string | undefined;

    public declare orgId: string;

    public declare parentId: string | undefined;
    public declare parent?: Policy;
    public declare getParent: BelongsToGetAssociationMixin<Policy>;

    public declare getChildren: HasManyGetAssociationsMixin<Policy>;
    public declare addChildren: HasManyAddAssociationsMixin<Policy, string>;
    public declare setChildren: HasManySetAssociationsMixin<Policy, string>;

    public declare penalty: UserPenaltySeverity;
    public declare userStrikeCount: number;
    public declare applyUserStrikeCountConfigToChildren: boolean;
    public declare semanticVersion: number;
    public declare policyType: PolicyType | undefined;

    public declare rules?: Rule[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      Policy.belongsTo(models.Org, { as: 'org' });
      Policy.hasMany(models.Policy, {
        as: 'children',
        foreignKey: 'parentId',
      });
      Policy.belongsTo(models.Policy, {
        as: 'parent',
        foreignKey: 'parentId',
      });
      Policy.belongsToMany(models.Rule, {
        through: 'rules_and_policies',
        as: 'rules',
      });
    }

    static async getPoliciesForRuleIds(ruleIds: readonly string[]) {
      const results = await Policy.findAll({
        where: { '$rules.id$': ruleIds },
        include: [{ association: 'rules', attributes: ['id'] }],
      });

      const ruleIdPolicyPairs = results.flatMap((policy) =>
        policy.rules!.map((rule) => [rule.id, policy] as const),
      );

      return mapValues(
        groupBy(ruleIdPolicyPairs, ([ruleId]) => ruleId),
        (pairs) => pairs.map(([, policy]) => policy),
      ) as { [ruleId: string]: Policy[] | undefined };
    }
  }

  /* Fields */
  Policy.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      orgId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      policyText: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parentId: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      policyType: {
        type: DataTypes.ENUM(...Object.values(PolicyType)),
        allowNull: true,
      },
      penalty: {
        type: DataTypes.STRING,
        defaultValue: UserPenaltySeverity.NONE,
        allowNull: false,
        validate: {
          notNull: true,
          isIn: [Object.values(UserPenaltySeverity)],
        },
      },
      userStrikeCount: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      applyUserStrikeCountConfigToChildren: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      semanticVersion: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
    },
    {
      sequelize,
      modelName: 'policy',
      underscored: true,
      tableName: 'policies',
    },
  );

  return Policy;
};

export default makePolicy;
