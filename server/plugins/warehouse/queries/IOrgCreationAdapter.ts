export interface IOrgCreationAdapter {
  logOrgCreated(
    id: string,
    name: string,
    email: string,
    websiteUrl: string,
    dateCreated: string,
  ): Promise<void>;
}

