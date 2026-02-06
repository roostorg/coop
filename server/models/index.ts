import pkg from 'sequelize';

/* Bank models */
import LocationBankLocation from './banks/LocationBankLocationModel.js';
import LocationBank from './banks/LocationBankModel.js';
/* High level models */
import Org from './OrgModel.js';
import Policy from './PolicyModel.js';
/* Rules models */
import Action from './rules/ActionModel.js';
import Backtest from './rules/BacktestModel.js';
import ItemType from './rules/ItemTypeModel.js';
import RuleLatestVersion from './rules/RuleLatestVersionModel.js';
import Rule from './rules/RuleModel.js';
/* Other */
import { makeSequelize, maketransactionWithRetry } from './sequelizeSetup.js';
import User from './UserModel.js';

const { Sequelize } = pkg;

// NB: this type includes a bunch of exports that are not the DataType constructors,
// but at least it also includes the DataTypes, so that we get autocomplete.
// I don't think the DataTypes type is actually exported on its own.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type DataTypes = typeof import('sequelize');

/* eslint-disable @typescript-eslint/no-explicit-any */
const makeDb = () => {
  const sequelize = makeSequelize();
  const db = {
    sequelize,
    Sequelize,
    Action: Action(sequelize, Sequelize as any),
    Backtest: Backtest(sequelize, Sequelize as any),
    ItemType: ItemType(sequelize, Sequelize as any),
    LocationBank: LocationBank(sequelize, Sequelize as any),
    LocationBankLocation: LocationBankLocation(sequelize, Sequelize as any),
    Org: Org(sequelize, Sequelize as any),
    Policy: Policy(sequelize, Sequelize as any),
    Rule: Rule(sequelize, Sequelize as any),
    RuleLatestVersion: RuleLatestVersion(sequelize, Sequelize as any),
    User: User(sequelize, Sequelize as any),
    transactionWithRetry: maketransactionWithRetry(sequelize),
    async close() {
      await sequelize.close();
    },
  };
  Object.values(db).forEach((model) => {
    if ('associate' in model) {
      model.associate(db);
    }
  });
  return db;
};

export default makeDb;
