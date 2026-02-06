import sequelize, {
  type HasOneGetAssociationMixin,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';

import { type DataTypes } from '../index.js';
import { type User } from '../UserModel.js';
import { type Rule } from './RuleModel.js';

const { Model } = sequelize;

export type Backtest = InstanceType<ReturnType<typeof makeBacktestModel>>;
export enum BacktestStatus {
  RUNNING = 'RUNNING',
  COMPLETE = 'COMPLETE',
  CANCELED = 'CANCELED',
}

const makeBacktestModel = (sequelize: Sequelize, DataTypes: DataTypes) => {
  class Backtest extends Model<
    InferAttributes<Backtest>,
    InferCreationAttributes<
      Backtest,
      // fields that _cannot be set explicitly_ at creation time, b/c they have
      // db defaults that must always apply (i.e., cannot be overriden) at creation.
      {
        omit:
          | 'contentItemsProcessed'
          | 'contentItemsMatched'
          | 'status'
          | 'createdAt'
          | 'updatedAt'
          | 'samplingComplete'
          | 'sampleActualSize'
          | 'cancelationDate';
      }
    >
  > {
    public declare id: string;

    public declare ruleId: string;
    public declare rule?: Rule;

    public declare creatorId: string;
    public declare creator?: User;

    public declare sampleDesiredSize: number;
    public declare sampleActualSize: number;
    public declare sampleStartAt: Date;
    public declare sampleEndAt: Date;

    public declare cancelationDate: Date;
    public declare samplingComplete: boolean;

    public declare contentItemsProcessed: number;
    public declare contentItemsMatched: number;

    public declare status: BacktestStatus;

    public declare createdAt: Date;
    public declare updatedAt: Date;

    declare getRule: HasOneGetAssociationMixin<Rule>;
    declare getCreator: HasOneGetAssociationMixin<User>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static associate(models: { [key: string]: any }) {
      Backtest.belongsTo(models.User, { as: 'Creator' });
      Backtest.belongsTo(models.Rule, { as: 'Rule' });
    }

    public static async hasRunningBacktestsForRule(ruleId: string) {
      // ugh the built-in sequelize query builder sucks.
      // https://github.com/sequelize/sequelize/issues/10187
      return Backtest.findOne({
        where: { ruleId, status: BacktestStatus.RUNNING },
      }).then((it) => it != null);
    }

    public static async cancelRunningBacktestsForRule(ruleId: string) {
      return Backtest.update(
        { cancelationDate: new Date() },
        { where: { ruleId, status: BacktestStatus.RUNNING } },
      );
    }

    public async cancel() {
      this.cancelationDate = new Date();
      await this.save();
      return this;
    }

    /**
     * Because our queues will deliver sampled content items to be processed
     * _at least once_, it’s possible that, rarely, contentItemsProcessed will
     * be greater than sampleActualSize. To mitigate this, we clamp the
     * exposed value for contentItemsProcessed at sampleActualSize.
     */
    public get correctedContentItemsProcessed(): NonAttribute<number> {
      return Math.min(this.sampleActualSize, this.contentItemsProcessed);
    }

    /**
     * Similar to {@see correctedContentItemsProcessed}, we clamp the exposed
     * value of contentItemsMatched, since we can't logically have matched more
     * items than we processed.
     */
    public get correctedContentItemsMatched(): NonAttribute<number> {
      return Math.min(
        this.correctedContentItemsProcessed,
        this.contentItemsMatched,
      );
    }
  }

  /* Fields */
  Backtest.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      ruleId: { type: DataTypes.STRING, allowNull: false },
      creatorId: { type: DataTypes.STRING, allowNull: false },

      sampleDesiredSize: { type: DataTypes.INTEGER, allowNull: false },
      sampleActualSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sampleStartAt: { type: DataTypes.DATE, allowNull: false },
      sampleEndAt: { type: DataTypes.DATE, allowNull: false },

      cancelationDate: { type: DataTypes.DATE },
      samplingComplete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      contentItemsProcessed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      contentItemsMatched: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      status: { type: DataTypes.STRING },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: 'backtest',
      underscored: true,
      timestamps: true,
    },
  );

  return Backtest;
};

export default makeBacktestModel;
