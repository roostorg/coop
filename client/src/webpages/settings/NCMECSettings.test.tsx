import {
  GQLNcmecMediaReviewRequirement,
  GQLNcmecOrgSettingsDocument,
  GQLUpdateNcmecOrgSettingsDocument,
  GQLUserPermission,
} from '@/graphql/generated';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import NCMECSettings from './NCMECSettings';

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('@/coop-ui/Toast', () => ({ toast }));

const savedSettings = {
  __typename: 'NcmecOrgSettings',
  username: 'espuser',
  password: 'esppass',
  contactEmail: 'reporter@example.com',
  moreInfoUrl: null,
  companyTemplate: 'AcmeESP',
  legalUrl: 'https://acme.example/legal',
  ncmecPreservationEndpoint: null,
  ncmecAdditionalInfoEndpoint: null,
  defaultNcmecQueueId: null,
  defaultInternetDetailType: null,
  termsOfService: null,
  contactPersonEmail: null,
  contactPersonFirstName: null,
  contactPersonLastName: null,
  contactPersonPhone: null,
  mediaReviewRequirement: GQLNcmecMediaReviewRequirement.All,
  minMediaToReview: null,
};

function settingsQueryMock(enabled: boolean): MockedResponse {
  return {
    request: { query: GQLNcmecOrgSettingsDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          permissions: [GQLUserPermission.ManageOrg],
        },
        ncmecOrgSettings: enabled ? savedSettings : null,
        myOrg: {
          __typename: 'Org',
          hasNCMECReportingEnabled: enabled,
          mrtQueues: [],
        },
      },
    },
  };
}

function updateMock(result: MockedResponse['result']): MockedResponse {
  const { __typename, ...input } = savedSettings;
  return {
    request: { query: GQLUpdateNcmecOrgSettingsDocument, variables: { input } },
    result,
  };
}

// Lets a test unmount the page and mount it again with the same Apollo cache,
// like navigating away from Settings and back.
function Page() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button onClick={() => setShown((s) => !s)}>toggle page</button>
      {shown && <NCMECSettings />}
    </>
  );
}

function renderPage(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <HelmetProvider>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </HelmetProvider>
    </MockedProvider>,
  );
}

function fillRequiredFields() {
  const fields: [RegExp, string][] = [
    [/^username/i, savedSettings.username],
    [/^password/i, savedSettings.password],
    [/company report name/i, savedSettings.companyTemplate],
    [/legal url/i, savedSettings.legalUrl],
    [/^contact email/i, savedSettings.contactEmail],
  ];
  for (const [label, value] of fields) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe('NCMECSettings', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the saved settings as enabled after the first save, and after navigating back', async () => {
    renderPage([
      settingsQueryMock(false),
      updateMock({
        data: {
          updateNcmecOrgSettings: {
            __typename: 'UpdateNcmecOrgSettingsResponse',
            success: true,
          },
        },
      }),
      settingsQueryMock(true),
    ]);

    expect(
      await screen.findByText('NCMEC reporting is not yet enabled.'),
    ).toBeInTheDocument();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable NCMEC & Save Settings' }),
    );

    expect(
      await screen.findByText('✓ NCMEC reporting is enabled'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'toggle page' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle page' }));

    expect(
      await screen.findByText('✓ NCMEC reporting is enabled'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^username/i)).toHaveValue(
      savedSettings.username,
    );
    expect(screen.getByLabelText(/legal url/i)).toHaveValue(
      savedSettings.legalUrl,
    );
  });

  it('keeps the typed values and the not-enabled state when the save fails', async () => {
    renderPage([
      settingsQueryMock(false),
      updateMock({ errors: [new GraphQLError('Invalid NCMEC credentials')] }),
      settingsQueryMock(true),
    ]);

    await screen.findByText('NCMEC reporting is not yet enabled.');
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable NCMEC & Save Settings' }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid NCMEC credentials'),
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    // Give a stray refetch the chance to land before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      screen.getByText('NCMEC reporting is not yet enabled.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^username/i)).toHaveValue(
      savedSettings.username,
    );
    expect(screen.getByLabelText(/legal url/i)).toHaveValue(
      savedSettings.legalUrl,
    );
  });
});
