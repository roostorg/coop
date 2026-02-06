import sequelize, {
  type HasManyAddAssociationsMixin,
  type HasManyGetAssociationsMixin,
  type HasManyGetAssociationsMixinOptions,
  type HasManySetAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';
import { type JsonObject } from 'type-fest';

import {
  ActionType,
  ItemTypeKind,
  UserPenaltySeverity,
} from '../../services/moderationConfigService/index.js';
import { validateUrlOrNull } from '../../utils/url.js';
import { type DataTypes } from '../index.js';
import { type ItemType as TContentType } from './ItemTypeModel.js';

const { Model } = sequelize;

// The default type an Action sequelize model instance.
// This type is vague, w/ more optional fields than we'll have at runtime, and
// not accounting for the rules that we've set up in pg for how different action
// type values constrain the values in other columns.
export type CollapsedSequelizeAction = InstanceType<
  ReturnType<typeof makeActionModel>
>;

// These types handle the different constraints per action type, mirroring pg.
export type EnqueueToMrtAction = CollapsedSequelizeAction & {
  actionType: (typeof ActionType)['ENQUEUE_TO_MRT'];
  callbackUrl: null;
};

export type EnqueueToNcmecAction = CollapsedSequelizeAction & {
  actionType: (typeof ActionType)['ENQUEUE_TO_NCMEC'];
  callbackUrl: null;
};

export type CustomAction = CollapsedSequelizeAction & {
  actionType: (typeof ActionType)['CUSTOM_ACTION'];
  callbackUrl: string;
};

export type EnqueueAuthorToMrtAction = CollapsedSequelizeAction & {
  actionType: (typeof ActionType)['ENQUEUE_AUTHOR_TO_MRT'];
  callbackUrl: string;
};

// And this is the more precise replacement for UntypedAction, which we
// use outside this file.
export type SequelizeAction =
  | EnqueueToMrtAction
  | EnqueueToNcmecAction
  | EnqueueAuthorToMrtAction
  | CustomAction;

/**
 * Data Model for Actions. Actions are components
 * of Rules that get executed if all Conditions are met.
 * Examples of Actions are Delete, Enqueue, Log, etc.
 */
const makeActionModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class Action extends Model<
    InferAttributes<Action>,
    InferCreationAttributes<Action>
  > {
    public declare id: string;
    public declare name: string;
    public declare orgId: string;
    public declare description: string | null;
    public declare callbackUrl: string | null;
    public declare callbackUrlHeaders: JsonObject | null;
    public declare callbackUrlBody: JsonObject | null;
    public declare customMrtApiParams: JsonObject | null;

    public declare penalty: UserPenaltySeverity;
    public declare actionType: ActionType;
    public declare appliesToAllItemsOfKind: ItemTypeKind[];
    public declare applyUserStrikes: boolean;

    public declare addContentTypes: HasManyAddAssociationsMixin<
      unknown,
      string
    >;
    public declare setContentTypes: HasManySetAssociationsMixin<
      unknown,
      string
    >;
    private declare getContentTypesSequelizeImpl: HasManyGetAssociationsMixin<unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      Action.belongsTo(models.Org, { as: 'org' });
      Action.belongsToMany(models.Rule, {
        through: 'rules_and_actions',
        as: 'rules',
      });

      // Assign the default sequelize getContentTypes function to another
      // name so that we can use it in the actual implemented function.
      //
      const contentTypeAssoc = Action.belongsToMany(models.ItemType, {
        through: 'actions_and_item_types',
        as: 'ContentTypes',
        otherKey: 'item_type_id',
      });
      Object.defineProperty(
        models.Action.prototype,
        'getContentTypesSequelizeImpl',
        {
          enumerable: false,
          value(...params: unknown[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (contentTypeAssoc as any)['get'](this, ...params);
          },
        },
      );
    }

    async getContentTypes(
      options?: HasManyGetAssociationsMixinOptions,
    ): Promise<TContentType[]> {
      const contentTypes =
        this.appliesToAllItemsOfKind.length > 0
          ? await this.sequelize.model('content_type').findAll({
              ...options,
              where: {
                ...options?.where,
                orgId: this.orgId,
                kind: this.appliesToAllItemsOfKind,
              },
            })
          : await this.getContentTypesSequelizeImpl(options);
      return contentTypes as TContentType[];
    }
  }

  /* Fields */
  Action.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      // Name of the action -- this must be unique for each Org (i.e. an Org can't
      // have two actions with the same name)
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      orgId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      callbackUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isValidUrl: validateUrlOrNull,
        },
      },
      callbackUrlHeaders: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      callbackUrlBody: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      customMrtApiParams: {
        type: DataTypes.ARRAY(DataTypes.JSONB),
        allowNull: true,
      },
      penalty: {
        type: DataTypes.STRING,
        defaultValue: UserPenaltySeverity.NONE,
        allowNull: false,
        validate: {
          isIn: [Object.values(UserPenaltySeverity)],
        },
      },
      actionType: {
        type: DataTypes.STRING,
        defaultValue: ActionType.CUSTOM_ACTION,
        allowNull: false,
        validate: {
          notNull: true,
          isIn: [Object.values(ActionType)],
        },
      },
      appliesToAllItemsOfKind: {
        field: 'applies_to_all_items_of_kind',
        type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(ItemTypeKind))),
        defaultValue: [],
      },
      applyUserStrikes: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'action',
      underscored: true,
    },
  );

  return Action;
};

export default makeActionModel;
