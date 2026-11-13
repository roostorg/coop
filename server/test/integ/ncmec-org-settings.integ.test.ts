import { uid } from 'uid';

import createOrg from '../fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

const filledSettings = {
  username: 'espuser',
  password: 'esppass',
  contactEmail: 'reporter@example.com',
  moreInfoUrl: 'https://acme.example/more-info',
  companyTemplate: 'AcmeESP',
  legalUrl: 'https://acme.example/legal',
  ncmecPreservationEndpoint: 'https://acme.example/preserve',
  ncmecAdditionalInfoEndpoint: 'https://acme.example/additional-info',
  defaultNcmecQueueId: null,
  defaultInternetDetailType: 'WEB_PAGE',
  termsOfService: null,
  contactPersonEmail: null,
  contactPersonFirstName: null,
  contactPersonLastName: null,
  contactPersonPhone: null,
  mediaReviewRequirement: 'ALL' as const,
  minMediaToReview: null,
};

describe('NcmecService.updateNcmecOrgSettings (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );
    return { orgId };
  });

  testWithFixture(
    'clears optional fields that are saved as null',
    async ({ deps, orgId }) => {
      await deps.NcmecService.updateNcmecOrgSettings({
        orgId,
        ...filledSettings,
      });
      await deps.NcmecService.updateNcmecOrgSettings({
        orgId,
        ...filledSettings,
        contactEmail: null,
        moreInfoUrl: null,
        companyTemplate: null,
        legalUrl: null,
        ncmecPreservationEndpoint: null,
        ncmecAdditionalInfoEndpoint: null,
      });

      const settings = await deps.NcmecService.getNcmecOrgSettings(orgId);
      expect(settings).toMatchObject({
        contactEmail: null,
        moreInfoUrl: null,
        companyTemplate: null,
        legalUrl: null,
        ncmecPreservationEndpoint: null,
        ncmecAdditionalInfoEndpoint: null,
      });
    },
  );
});
