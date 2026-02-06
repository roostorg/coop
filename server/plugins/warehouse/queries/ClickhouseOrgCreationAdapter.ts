import { type IOrgCreationAdapter } from './IOrgCreationAdapter.js';
import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import type SafeTracer from '../../../utils/SafeTracer.js';

export class ClickhouseOrgCreationAdapter implements IOrgCreationAdapter {
  constructor(
    private readonly dataWarehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

  async logOrgCreated(
    id: string,
    name: string,
    email: string,
    websiteUrl: string,
    dateCreated: string,
  ): Promise<void> {
    await this.dataWarehouse.query(
      `INSERT INTO analytics.ALL_ORGS (id, name, email, website_url, date_created) VALUES ($1, $2, $3, $4, $5)`,
      this.tracer,
      [id, name, email, websiteUrl, dateCreated],
    );
  }
}

