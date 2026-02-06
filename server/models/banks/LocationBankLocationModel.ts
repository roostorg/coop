import sequelize, {
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { type DataTypes } from '../index.js';
import { type LocationArea } from '../types/locationArea.js';

const { Model } = sequelize;

export type LocationBankLocation = InstanceType<
  ReturnType<typeof makeLocationBankLocationModel>
>;

/**
 * Data Model for Location Banks. Location Banks are sets of locations
 * used for distance checks.
 */
const makeLocationBankLocationModel = (
  sequelize: Sequelize,
  DataTypes: DataTypes,
) => {
  class LocationBankLocation
    extends Model<
      InferAttributes<LocationBankLocation>,
      InferCreationAttributes<LocationBankLocation>
    >
    implements LocationArea
  {
    public declare id: string;
    public declare bankId: string;
    public declare name?: string;
    public declare geometry: LocationArea['geometry'];
    public declare bounds: LocationArea['bounds'] | null;
    public declare googlePlaceInfo: LocationArea['googlePlaceInfo'] | null;
  }

  /* Fields */
  LocationBankLocation.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      bankId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      geometry: {
        allowNull: false,
        type: DataTypes.JSONB,
      },
      bounds: {
        allowNull: true,
        type: DataTypes.JSONB,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty: true,
        },
      },
      googlePlaceInfo: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'location_bank_locations',
      underscored: true,
    },
  );

  return LocationBankLocation;
};

export default makeLocationBankLocationModel;
