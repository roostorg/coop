import sequelize, {
  type CreationOptional,
  type HasManyGetAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { validateUrl } from '../utils/url.js';
import { type LocationBank } from './banks/LocationBankModel.js';
import { type DataTypes } from './index.js';
import { type Policy } from './PolicyModel.js';
import { type SequelizeAction } from './rules/ActionModel.js';
import { type Rule } from './rules/RuleModel.js';
import { type User } from './UserModel.js';

const { Model } = sequelize;

export type Org = InstanceType<ReturnType<typeof makeOrgModel>>;

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
