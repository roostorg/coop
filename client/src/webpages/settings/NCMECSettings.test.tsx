import {
  GQLNcmecMediaReviewRequirement,
  GQLNcmecOrgSettingsDocument,
  GQLUpdateNcmecOrgSettingsDocument,
  GQLUserPermission,
} from '@/graphql/generated';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// jsdom implements neither the Pointer Events capture API nor
// `scrollIntoView`, which the Radix select calls when it opens.
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture ||= () => false;
  window.HTMLElement.prototype.releasePointerCapture ||= () => {};
  window.HTMLElement.prototype.setPointerCapture ||= () => {};
  window.HTMLElement.prototype.scrollIntoView ||= () => {};
});

const reportedCsamBank = {
  __typename: 'HashBank',
  id: '7',
  name: 'Reported CSAM',
};

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
  reportedMediaHashBankId: null as number | null,
};

function settingsQueryMock(
  enabled: boolean,
  settings = savedSettings,
): MockedResponse {
  return {
    request: { query: GQLNcmecOrgSettingsDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          permissions: [GQLUserPermission.ManageOrg],
        },
        ncmecOrgSettings: enabled ? settings : null,
        hashBanks: [reportedCsamBank],
        myOrg: {
          __typename: 'Org',
          hasNCMECReportingEnabled: enabled,
          mrtQueues: [],
        },
      },
    },
  };
}

function updateMock(
  result: MockedResponse['result'],
  settings = savedSettings,
): MockedResponse {
  const { __typename, ...input } = settings;
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

  it('saves the picked hash bank by its numeric id and shows it after navigating back', async () => {
    const withBank = { ...savedSettings, reportedMediaHashBankId: 7 };
    renderPage([
      settingsQueryMock(true),
      updateMock(
        {
          data: {
            updateNcmecOrgSettings: {
              __typename: 'UpdateNcmecOrgSettingsResponse',
              success: true,
            },
          },
        },
        withBank,
      ),
      settingsQueryMock(true, withBank),
    ]);

    userEvent.click(
      await screen.findByLabelText(/hash bank for reported media/i),
    );
    userEvent.click(
      await screen.findByRole('option', { name: reportedCsamBank.name }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update Settings' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'toggle page' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle page' }));

    await waitFor(() =>
      expect(
        screen.getByLabelText(/hash bank for reported media/i),
      ).toHaveTextContent(reportedCsamBank.name),
    );
  });
});
