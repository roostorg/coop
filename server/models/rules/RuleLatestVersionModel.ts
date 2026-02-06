import sequelize, { type Sequelize } from 'sequelize';

import { type DataTypes } from '../index.js';

const { Model } = sequelize;

export type RuleLatestVersion = InstanceType<
  ReturnType<typeof makeRuleLatestVersionModel>
>;

const makeRuleLatestVersionModel = (
  sequelize: Sequelize,
  DataTypes: DataTypes,
) => {
  class RuleLatestVersion extends Model {
    public declare readonly ruleId: string;
    public declare readonly version: string;
  }

  /* Fields */
  RuleLatestVersion.init(
    {
      ruleId: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      version: {
        // Read version into JS as a string, not a date, because the date holds
        // more digits of precision than JS can store, and we can't throw those
        // away when we write this field's value out elsewhere.
        type: DataTypes.STRING,
      },
    },
    {
      sequelize,
      tableName: 'rules_latest_versions',
      underscored: true,
      timestamps: false,
    },
  );

  return RuleLatestVersion;
};

export default makeRuleLatestVersionModel;
