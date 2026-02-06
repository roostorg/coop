import { inject, type Dependencies } from '../../iocContainer/index.js';
import { getUtcDateOnlyString } from '../../utils/time.js';

class OrgCreationLogger {
  constructor(
    private readonly orgCreationAdapter: Dependencies['OrgCreationAdapter'],
  ) {}

  async logOrgCreated(
    id: string,
    name: string,
    email: string,
    websiteUrl: string,
  ) {
    await this.orgCreationAdapter.logOrgCreated(
      id,
      name,
      email,
      websiteUrl,
      getUtcDateOnlyString(),
    );
  }
}

export default inject(['OrgCreationAdapter'], OrgCreationLogger);
export { type OrgCreationLogger };
