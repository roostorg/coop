import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { logErrorAndThrow } from '../utils.js';

export default async function (
  models: Dependencies['Sequelize'],
  orgId: string,
  extra: { id?: string } = {},
) {
  const user = await models.User.create({
    orgId,
    id: extra.id ?? uid(),
    email: faker.internet.email(),
    password: '',
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    loginMethods: ['password'],
  }).catch(logErrorAndThrow);

  return {
    user,
    async cleanup() {
      await user.destroy();
    },
  };
}
