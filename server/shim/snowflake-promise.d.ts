declare module "snowflake-promise" {
  export class Snowflake {
    constructor(connOpts: unknown);
    connect(): Promise<void>;
    destroy(): Promise<void>;
    execute(sqlText: string, binds?: any[]): Promise<any[]>;
  }
}
