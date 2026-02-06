import sequelize, {
  type HasManyAddAssociationsMixin,
  type HasManyGetAssociationsMixin,
  type HasManyRemoveAssociationsMixin,
  type HasManySetAssociationsMixin,
  type HasOneGetAssociationMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { type DataTypes } from '../index.js';
import { type User } from '../UserModel.js';
import { type LocationBankLocation } from './LocationBankLocationModel.js';

const { Model } = sequelize;

export type LocationBank = InstanceType<
  ReturnType<typeof makeLocationBankModel>
>;

/**
 * Data Model for Location Banks. Location Banks are sets of locations
 * used for distance checks.
 */
const makeLocationBankModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class LocationBank extends Model<
    InferAttributes<LocationBank>,
    InferCreationAttributes<LocationBank>
  > {
    public declare id: string;
    public declare name: string;
    public declare description?: string | null;
    public declare orgId: string;
    public declare ownerId: string;
    public declare locations?: LocationBankLocation[];

    public declare getOwner: HasOneGetAssociationMixin<User>;
    public declare getLocations: HasManyGetAssociationsMixin<LocationBankLocation>;
    public declare setLocations: HasManySetAssociationsMixin<
      LocationBankLocation,
      string
    >;
    public declare addLocations: HasManyAddAssociationsMixin<
      LocationBankLocation,
      string
    >;
    public declare removeLocations: HasManyRemoveAssociationsMixin<
      LocationBankLocation,
      string
    >;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      LocationBank.belongsTo(models.Org, { as: 'org' });
      LocationBank.belongsTo(models.User, { as: 'owner' });
      LocationBank.hasMany(models.LocationBankLocation, {
        as: 'locations',
        foreignKey: 'bank_id',
        onDelete: 'CASCADE',
      });
    }
  }

  /* Fields */
  LocationBank.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      orgId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      ownerId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      // Name of the location bank -- this must be unique for each Org
      // (i.e. an Org can't have two location banks with the same name)
      name: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty: true,
        },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'location_bank',
      underscored: true,
    },
  );

  return LocationBank;
};

export default makeLocationBankModel;
