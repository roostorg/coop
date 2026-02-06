import { ItemTypeKind } from '@roostorg/types';
import _ from 'lodash';
import sequelize, {
  type BelongsToGetAssociationMixin,
  type HasManyAddAssociationsMixin,
  type HasManyGetAssociationsMixin,
  type HasManyGetAssociationsMixinOptions,
  type HasManySetAssociationsMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { type ItemSchema } from '../../services/moderationConfigService/index.js';
import { type DataTypes } from '../index.js';
import { type Org } from '../OrgModel.js';
import { type SequelizeAction } from './ActionModel.js';
import { type Rule, type RuleWithLatestVersion } from './RuleModel.js';

const { Model } = sequelize;

export type ItemType = InstanceType<ReturnType<typeof makeItemTypeModel>>;

const makeItemTypeModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class ItemType extends Model<
    InferAttributes<ItemType>,
    InferCreationAttributes<ItemType>
  > {
    public declare id: string;
    public declare name: string;
    public declare description?: string | null;
    public declare fields: ItemSchema;
    public declare getRules: HasManyGetAssociationsMixin<Rule>;

    public declare orgId: string;
    public declare getOrg: BelongsToGetAssociationMixin<Org>;
    public declare kind: ItemTypeKind;

    public declare addActions: HasManyAddAssociationsMixin<
      SequelizeAction,
      string
    >;
    public declare setActions: HasManySetAssociationsMixin<
      SequelizeAction,
      string
    >;
    private declare getActionsSequelizeImpl: HasManyGetAssociationsMixin<SequelizeAction>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      ItemType.belongsTo(models.Org, { as: 'Org' });
      ItemType.belongsToMany(models.Rule, {
        through: 'rules_and_item_types',
        foreignKey: 'item_type_id',
        as: 'Rules',
      });

      const actionAssoc = ItemType.belongsToMany(models.Action, {
        through: 'actions_and_item_types',
        foreignKey: 'item_type_id',
        as: 'Actions',
      });
      Object.defineProperty(
        models.ItemType.prototype,
        'getActionsSequelizeImpl',
        {
          enumerable: false,
          value(...params: unknown[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (actionAssoc as any)['get'](this, ...params);
          },
        },
      );
    }

    /**
     * This function returns the list of rules that are "enabled", meaning that
     * we'd run them against a new piece of content of this content type, if the
     * content were submitted right now. "Running the rule" just means checking
     * if its conditions pass on the content; whether we'd run the actions of
     * each passing rule is a different question.
     *
     * This function is _highly_ impure. Its results will change as rules
     * expire, or as daily limits on rules are reached, among other things. As
     * we see more use cases, we might wanna refactor where this lives.
     */
    async getEnabledRules() {
      return this.getRules({
        scope: 'enabled',
        include: ['latestVersion'],
      }) as Promise<RuleWithLatestVersion[]>;
    }

    async getActions(
      options?: HasManyGetAssociationsMixinOptions,
    ): Promise<SequelizeAction[]> {
      return sequelize.transaction(async () => {
        const [explicitlyAssociatedActions, allActions] = await Promise.all([
          this.getActionsSequelizeImpl(options),
          this.sequelize.model('action').findAll({
            ...options,
            where: {
              ...options?.where,
              orgId: this.orgId,
            },
          }),
        ]);

        return _.uniqBy(
          [
            // Do this filter outside of the sequelize query because Sequelize
            // assumes the name of the enum and doesn't allow you to set it
            ...(allActions as SequelizeAction[]).filter((it) =>
              it.appliesToAllItemsOfKind.includes(this.kind),
            ),
            ...explicitlyAssociatedActions,
          ],
          (it) => it.id,
        );
      });
    }
  }

  /* Fields */
  ItemType.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      orgId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Name of the item type, which must unique within each Org
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      fields: {
        type: DataTypes.ARRAY(DataTypes.JSONB),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      kind: {
        type: DataTypes.ENUM(...Object.values(ItemTypeKind)),
        allowNull: false,
        defaultValue: ItemTypeKind.CONTENT,
      },
    },
    {
      sequelize,
      // legacy name; left as-is in case changing it will break auto-generated
      // methods added by sequelize and calls to sequelize.model('content_type')
      // and possibly many other things on which don't have great typescript
      // support to check us.
      modelName: 'content_type',
      underscored: true,
      tableName: 'item_types',
      updatedAt: false,
    },
  );

  return ItemType;
};

export default makeItemTypeModel;
