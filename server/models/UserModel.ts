import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import sequelize, {
  type CreationOptional,
  type HasManyAddAssociationsMixin,
  type HasManyGetAssociationsMixin,
  type HasManyRemoveAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { type DataTypes } from './index.js';
import { getPermissionsForRole, UserRole } from './types/permissioning.js';

const { Model } = sequelize;
const bcryptCompare = promisify(bcrypt.compare);

export type User = InstanceType<ReturnType<typeof makeUserModel>>;

/**
 * Data Model for Users. Users are Coop users who have
 * created profiles on our website. Actors (see ActorModel.js)
 * are users on the organization's platforms that upload potentially
 * problematic content.
 */
const makeUserModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class User extends Model<
    InferAttributes<User, { omit: 'createdAt' | 'updatedAt' }>,
    InferCreationAttributes<User, { omit: 'createdAt' | 'updatedAt' }>
  > {
    public declare id: string;
    public declare email: string;
    public declare password: string | null;
    public declare firstName: string;
    public declare lastName: string;
    public declare orgId: string;
    public declare role: CreationOptional<UserRole>;
    public declare approvedByAdmin: CreationOptional<boolean>;
    public declare rejectedByAdmin: CreationOptional<boolean>;
    public declare createdAt: Date;
    public declare updatedAt: Date;
    public declare loginMethods: ('password' | 'saml')[];

    // Have to use any below to avoid circular type errors
    /* eslint-disable @typescript-eslint/no-explicit-any */
    public declare addFavoriteRules: HasManyAddAssociationsMixin<any, string>;
    public declare removeFavoriteRules: HasManyRemoveAssociationsMixin<
      any,
      string
    >;
    public declare getFavoriteRules: HasManyGetAssociationsMixin<any>;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      User.belongsTo(models.Org, { as: 'Org' });
      User.hasMany(models.Rule, { as: 'Rules', foreignKey: 'creatorId' });
      User.hasMany(models.LocationBank, {
        as: 'LocationBanks',
        foreignKey: 'ownerId',
      });
      User.hasMany(models.Backtest, {
        as: 'Backtests',
        foreignKey: 'creatorId',
      });
      User.belongsToMany(models.Rule, {
        as: 'FavoriteRules',
        through: 'users_and_favorite_rules',
      });
    }

    static async passwordMatchesHash(givenPassword: string, hash: string) {
      return bcryptCompare(givenPassword, hash);
    }

    public getPermissions() {
      return getPermissionsForRole(this.role);
    }
  }

  /* Fields */
  User.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      orgId: {
        type: DataTypes.STRING,
        allowNull: false,
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
      password: {
        type: DataTypes.STRING,
        unique: false,
      },
      firstName: {
        type: DataTypes.STRING,
        unique: false,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      lastName: {
        type: DataTypes.STRING,
        unique: false,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      role: {
        type: DataTypes.STRING,
        unique: false,
        defaultValue: UserRole.ADMIN,
        validate: {
          isIn: [Object.values(UserRole)],
        },
      },
      // Has the user been approved by the admin as part of the org
      approvedByAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Has the user been rejected by the admin as part of the org
      rejectedByAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      loginMethods: {
        type: DataTypes.ARRAY(DataTypes.ENUM('password', 'saml')),
        defaultValue: ['password'],
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'user',
      underscored: true,
    },
  );

  return User;
};

export default makeUserModel;
