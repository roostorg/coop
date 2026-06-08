import { TooltipProvider } from '@/coop-ui/Tooltip';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLDeploymentSettingsDocument,
  GQLOrgDefaultSafetySettingsDocument,
  GQLOrgSettingsDocument,
  GQLSetOrgDefaultSafetySettingsDocument,
  GQLUpdateAppealSettingsDocument,
  GQLUpdateHasAppealsEnabledDocument,
  GQLUpdateIgnoreCallbackUrlDocument,
  GQLUpdateOrgInfoDocument,
  GQLUpdatePartialItemsSettingsDocument,
  GQLUpdateRequiresPolicyForDecisionsDocument,
  GQLUpdateSsoCredentialsDocument,
  GQLUpdateUserStrikeTtlDocument,
} from '@/graphql/generated';

import SettingsPage from './SettingsPage';

function renderWithProviders(mocks: MockedResponse[], tab = 'organization') {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <MockedProvider mocks={mocks}>
          <MemoryRouter initialEntries={[`/dashboard/settings?tab=${tab}`]}>
            <SettingsPage />
          </MemoryRouter>
        </MockedProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );
}

const orgSettingsMock: MockedResponse = {
  request: { query: GQLOrgSettingsDocument },
  maxUsageCount: Infinity,
  result: {
    data: {
      myOrg: {
        id: 'org-1',
        name: 'Test Org',
        email: 'test@example.com',
        websiteUrl: 'https://example.com',
        onCallAlertEmail: 'oncall@example.com',
      },
      me: { id: 'user-1', permissions: ['MANAGE_ORG'] },
    },
  },
};

const deploymentSettingsMock: MockedResponse = {
  request: { query: GQLDeploymentSettingsDocument },
  maxUsageCount: Infinity,
  result: {
    data: {
      me: { id: 'user-1', permissions: ['MANAGE_ORG'] },
      myOrg: {
        id: 'org-1',
        samlEnabled: false,
        ssoUrl: null,
        ssoCert: null,
        hasAppealsEnabled: false,
        hasReportingRulesEnabled: false,
        allowMultiplePoliciesPerAction: false,
        requiresPolicyForDecisionsInMrt: false,
        requiresDecisionReasonInMrt: false,
        hideSkipButtonForNonAdmins: false,
        previewJobsViewEnabled: false,
        ignoreCallbackUrl: null,
        userStrikeTTL: 90,
        partialItemsEndpoint: null,
        partialItemsRequestHeaders: null,
      },
      appealSettings: {
        appealsCallbackUrl: null,
        appealsCallbackHeaders: null,
        appealsCallbackBody: null,
      },
    },
  },
};

function makeDeploymentMock(
  overrides: Record<string, unknown> = {},
  appealOverrides: Record<string, unknown> = {},
): MockedResponse {
  const base = deploymentSettingsMock.result as {
    data: Record<string, unknown>;
  };
  const baseOrg = base.data.myOrg as Record<string, unknown>;
  const baseAppeal = base.data.appealSettings as Record<string, unknown>;
  return {
    request: { query: GQLDeploymentSettingsDocument },
    maxUsageCount: Infinity,
    result: {
      data: {
        ...base.data,
        myOrg: { ...baseOrg, ...overrides },
        appealSettings: { ...baseAppeal, ...appealOverrides },
      },
    },
  };
}

const wellnessSettingsMock: MockedResponse = {
  request: { query: GQLOrgDefaultSafetySettingsDocument },
  maxUsageCount: Infinity,
  result: {
    data: {
      me: { permissions: ['MANAGE_ORG'] },
      myOrg: {
        defaultInterfacePreferences: {
          moderatorSafetyBlurLevel: 2,
          moderatorSafetyGrayscale: true,
          moderatorSafetyMuteVideo: true,
        },
      },
    },
  },
};

async function waitForOrgTabLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Organization Profile')).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByDisplayValue('Test Org')).toBeInTheDocument();
  });
}

describe('SettingsPage', () => {
  describe('tab navigation', () => {
    it('renders all six tabs with organization selected by default', () => {
      renderWithProviders([orgSettingsMock]);
      expect(
        screen.getByRole('tab', { name: /organization/i }),
      ).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getByRole('tab', { name: /single sign-on/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /appeals/i })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /review console/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /wellness/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /other/i })).toBeInTheDocument();
    });

    it('switches tabs on click', () => {
      renderWithProviders([orgSettingsMock, deploymentSettingsMock]);
      const ssoTab = screen.getByRole('tab', { name: /single sign-on/i });
      fireEvent.click(ssoTab);
      expect(ssoTab).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getByRole('tab', { name: /organization/i }),
      ).toHaveAttribute('aria-selected', 'false');
    });

    it('respects ?tab= search param on initial render', async () => {
      renderWithProviders([deploymentSettingsMock], 'review-console');
      expect(
        screen.getByRole('tab', { name: /review console/i }),
      ).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(screen.getByText('Moderator Requirements')).toBeInTheDocument();
      });
    });
  });

  describe('Organization tab', () => {
    it('populates fields and disables save when unchanged', async () => {
      renderWithProviders([orgSettingsMock]);
      await waitForOrgTabLoaded();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('https://example.com'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    it('enables save when a field changes, disables for invalid input', async () => {
      renderWithProviders([orgSettingsMock]);
      await waitForOrgTabLoaded();

      fireEvent.change(screen.getByDisplayValue('Test Org'), {
        target: { value: 'New Org' },
      });
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();

      fireEvent.change(screen.getByDisplayValue('test@example.com'), {
        target: { value: 'not-an-email' },
      });
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    it('calls updateOrgInfo mutation on save', async () => {
      const mutationFn = vi.fn(() => ({
        data: {
          updateOrgInfo: { __typename: 'UpdateOrgInfoSuccessResponse' },
        },
      }));
      const mutationMock: MockedResponse = {
        request: {
          query: GQLUpdateOrgInfoDocument,
          variables: {
            input: {
              name: 'Updated Org',
              email: 'test@example.com',
              websiteUrl: 'https://example.com',
              onCallAlertEmail: 'oncall@example.com',
            },
          },
        },
        newData: mutationFn,
      };

      renderWithProviders([orgSettingsMock, mutationMock]);
      await waitForOrgTabLoaded();

      fireEvent.change(screen.getByDisplayValue('Test Org'), {
        target: { value: 'Updated Org' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });
  });

  describe('SSO tab', () => {
    it('shows fields and disables SAML toggle without credentials', async () => {
      renderWithProviders([deploymentSettingsMock], 'sso');
      await waitFor(() => {
        expect(screen.getByText('Enable SAML/SSO')).toBeInTheDocument();
      });
      expect(screen.getByRole('switch')).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    it('enables SAML toggle when credentials exist', async () => {
      const mock = makeDeploymentMock({
        ssoUrl: 'https://idp.example.com/saml',
        ssoCert: 'CERT_DATA',
      });
      renderWithProviders([mock], 'sso');
      await waitFor(() => {
        expect(screen.getByRole('switch')).not.toBeDisabled();
      });
    });

    it('validates URL and requires both fields for save', async () => {
      renderWithProviders([deploymentSettingsMock], 'sso');
      await waitFor(() => {
        expect(screen.getByText('SSO URL')).toBeInTheDocument();
      });

      const urlInput = screen.getByPlaceholderText(
        'https://idp.example.com/saml',
      );
      fireEvent.change(urlInput, { target: { value: 'not-a-url' } });
      expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();

      fireEvent.change(urlInput, {
        target: { value: 'https://idp.example.com/saml' },
      });
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();

      fireEvent.change(
        screen.getByPlaceholderText('-----BEGIN CERTIFICATE-----'),
        { target: { value: 'CERT_DATA' } },
      );
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();
    });

    it('calls save credentials mutation', async () => {
      const mutationFn = vi.fn(() => ({
        data: { updateSSOCredentials: true },
      }));
      const mutationMock: MockedResponse = {
        request: {
          query: GQLUpdateSsoCredentialsDocument,
          variables: {
            input: {
              ssoUrl: 'https://idp.example.com/saml',
              ssoCert: 'CERT_DATA',
            },
          },
        },
        newData: mutationFn,
      };

      renderWithProviders([deploymentSettingsMock, mutationMock], 'sso');
      await waitFor(() => {
        expect(screen.getByText('SSO URL')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('https://idp.example.com/saml'),
        { target: { value: 'https://idp.example.com/saml' } },
      );
      fireEvent.change(
        screen.getByPlaceholderText('-----BEGIN CERTIFICATE-----'),
        { target: { value: 'CERT_DATA' } },
      );
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });

    it('shows enforcement dialog when enabling SSO', async () => {
      const mock = makeDeploymentMock({
        ssoUrl: 'https://idp.example.com/saml',
        ssoCert: 'CERT_DATA',
      });
      renderWithProviders([mock], 'sso');
      await waitFor(() => {
        expect(screen.getByRole('switch')).not.toBeDisabled();
      });

      userEvent.click(screen.getByRole('switch'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const enforceButton = within(dialog).getByRole('button', {
        name: /enforce sso/i,
      });
      expect(enforceButton).toBeDisabled();

      userEvent.click(screen.getByRole('checkbox'));
      expect(enforceButton).not.toBeDisabled();
    });
  });

  describe('Appeals tab', () => {
    it('shows toggle and callback fields', async () => {
      renderWithProviders([deploymentSettingsMock], 'appeals');
      await waitFor(() => {
        expect(screen.getByText('Enable Appeals')).toBeInTheDocument();
        expect(screen.getByText('Appeal Callback URL')).toBeInTheDocument();
      });
    });

    it('validates JSON in callback headers', async () => {
      renderWithProviders([deploymentSettingsMock], 'appeals');
      await waitFor(() => {
        expect(screen.getByText('Appeal Callback Headers')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText(/Authorization.*Bearer/), {
        target: { value: 'not json' },
      });
      expect(screen.getByText('Must be valid JSON')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    it('calls appeals mutations on save', async () => {
      const enabledFn = vi.fn(() => ({
        data: { updateHasAppealsEnabled: true },
      }));
      const settingsFn = vi.fn(() => ({
        data: { updateAppealSettings: true },
      }));

      renderWithProviders(
        [
          deploymentSettingsMock,
          {
            request: {
              query: GQLUpdateHasAppealsEnabledDocument,
              variables: { enabled: true },
            },
            newData: enabledFn,
          },
          {
            request: {
              query: GQLUpdateAppealSettingsDocument,
              variables: {
                input: {
                  appealsCallbackUrl: 'https://example.com/hook',
                  appealsCallbackHeaders: null,
                  appealsCallbackBody: null,
                },
              },
            },
            newData: settingsFn,
          },
        ],
        'appeals',
      );
      await waitFor(() => {
        expect(screen.getByText('Enable Appeals')).toBeInTheDocument();
      });

      userEvent.click(screen.getByRole('switch'));
      fireEvent.change(
        screen.getByPlaceholderText('https://example.com/webhook'),
        { target: { value: 'https://example.com/hook' } },
      );
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(enabledFn).toHaveBeenCalled();
        expect(settingsFn).toHaveBeenCalled();
      });
    });
  });

  describe('Review Console tab', () => {
    it('shows all settings sections', async () => {
      renderWithProviders([deploymentSettingsMock], 'review-console');
      await waitFor(() => {
        expect(screen.getByText('Moderator Requirements')).toBeInTheDocument();
        expect(screen.getByText('Queue Management')).toBeInTheDocument();
        expect(screen.getByText('Webhooks')).toBeInTheDocument();
      });
    });

    it('reflects initial toggle states from server data', async () => {
      const mock = makeDeploymentMock({
        requiresPolicyForDecisionsInMrt: true,
        requiresDecisionReasonInMrt: true,
        hideSkipButtonForNonAdmins: true,
        previewJobsViewEnabled: true,
      });
      renderWithProviders([mock], 'review-console');
      await waitFor(() => {
        expect(screen.getByText('Moderator Requirements')).toBeInTheDocument();
      });
      screen.getAllByRole('switch').forEach((s) => {
        expect(s).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('calls require policy mutation on save', async () => {
      const mutationFn = vi.fn(() => ({
        data: { updateRequiresPolicyForDecisions: true },
      }));

      renderWithProviders(
        [
          deploymentSettingsMock,
          {
            request: {
              query: GQLUpdateRequiresPolicyForDecisionsDocument,
              variables: { enabled: true },
            },
            newData: mutationFn,
          },
        ],
        'review-console',
      );
      await waitFor(() => {
        expect(
          screen.getByText('Require Policy for Decisions'),
        ).toBeInTheDocument();
      });

      userEvent.click(screen.getAllByRole('switch')[0]);
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });

    it('validates and sends ignore callback URL', async () => {
      renderWithProviders([deploymentSettingsMock], 'review-console');
      await waitFor(() => {
        expect(screen.getByText('Ignore Callback URL')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(
        'https://example.com/webhook/ignore',
      );
      fireEvent.change(input, { target: { value: 'not-valid' } });
      expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    it('sends null for empty ignore callback URL', async () => {
      const mock = makeDeploymentMock({
        ignoreCallbackUrl: 'https://old.com/hook',
      });
      const mutationFn = vi.fn(() => ({
        data: { updateIgnoreCallbackUrl: true },
      }));

      renderWithProviders(
        [
          mock,
          {
            request: {
              query: GQLUpdateIgnoreCallbackUrlDocument,
              variables: { url: null },
            },
            newData: mutationFn,
          },
        ],
        'review-console',
      );
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('https://old.com/hook'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('https://old.com/hook'), {
        target: { value: '' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });
  });

  describe('Wellness tab', () => {
    it('shows controls and reflects server state', async () => {
      renderWithProviders([wellnessSettingsMock], 'wellness');
      await waitFor(() => {
        expect(
          screen.getByText('Default Wellness Settings'),
        ).toBeInTheDocument();
        expect(screen.getByText('Blur Media')).toBeInTheDocument();
        expect(screen.getByText('Greyscale')).toBeInTheDocument();
        expect(screen.getByText('Mute videos')).toBeInTheDocument();
      });
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      expect(switches[1]).toHaveAttribute('aria-checked', 'true');
    });

    it('calls save mutation with updated settings', async () => {
      const mutationFn = vi.fn(() => ({
        data: { setOrgDefaultSafetySettings: true },
      }));

      renderWithProviders(
        [
          wellnessSettingsMock,
          {
            request: {
              query: GQLSetOrgDefaultSafetySettingsDocument,
              variables: {
                orgDefaultSafetySettings: {
                  moderatorSafetyBlurLevel: 2,
                  moderatorSafetyGrayscale: false,
                  moderatorSafetyMuteVideo: true,
                },
              },
            },
            newData: mutationFn,
          },
        ],
        'wellness',
      );
      await waitFor(() => {
        expect(screen.getByText('Greyscale')).toBeInTheDocument();
      });

      userEvent.click(screen.getAllByRole('switch')[0]);
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });
  });

  describe('Other tab', () => {
    it('shows toggles, strike TTL, and partial items', async () => {
      renderWithProviders([deploymentSettingsMock], 'other');
      await waitFor(() => {
        expect(
          screen.getByText('Multiple Policies Per Action'),
        ).toBeInTheDocument();
        expect(screen.getByText('User Strike TTL (Days)')).toBeInTheDocument();
        expect(screen.getByDisplayValue('90')).toBeInTheDocument();
        expect(screen.getByText('Partial Items Endpoint')).toBeInTheDocument();
        expect(
          screen.getByText('Partial Items Request Headers'),
        ).toBeInTheDocument();
      });
      // Reporting Rules is temporarily hidden from the UI while the feature
      // is being reworked.
      expect(
        screen.queryByText('Enable Reporting Rules'),
      ).not.toBeInTheDocument();
    });

    it('calls strike TTL mutation on save', async () => {
      const mutationFn = vi.fn(() => ({
        data: {
          updateUserStrikeTTL: {
            __typename: 'UpdateUserStrikeTtlSuccessResponse',
          },
        },
      }));

      renderWithProviders(
        [
          deploymentSettingsMock,
          {
            request: {
              query: GQLUpdateUserStrikeTtlDocument,
              variables: { input: { ttlDays: 30 } },
            },
            newData: mutationFn,
          },
        ],
        'other',
      );
      await waitFor(() => {
        expect(screen.getByDisplayValue('90')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('90'), {
        target: { value: '30' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });

    it('calls partial items mutation on save', async () => {
      const mutationFn = vi.fn(() => ({
        data: { updatePartialItemsSettings: true },
      }));

      renderWithProviders(
        [
          deploymentSettingsMock,
          {
            request: {
              query: GQLUpdatePartialItemsSettingsDocument,
              variables: {
                input: {
                  partialItemsEndpoint: 'https://api.example.com/items',
                  partialItemsRequestHeaders: null,
                },
              },
            },
            newData: mutationFn,
          },
        ],
        'other',
      );
      await waitFor(() => {
        expect(screen.getByText('Partial Items Endpoint')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('https://api.example.com/items'),
        { target: { value: 'https://api.example.com/items' } },
      );
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalled();
      });
    });
  });

  describe('error states', () => {
    it('shows error for each query type', async () => {
      const cases = [
        {
          query: GQLOrgSettingsDocument,
          tab: 'organization',
          text: 'Error loading organization settings',
        },
        {
          query: GQLDeploymentSettingsDocument,
          tab: 'sso',
          text: 'Error loading SSO settings',
        },
        {
          query: GQLOrgDefaultSafetySettingsDocument,
          tab: 'wellness',
          text: 'Error loading wellness settings',
        },
      ];

      for (const { query, tab, text } of cases) {
        const { unmount } = renderWithProviders(
          [{ request: { query }, error: new Error('Network error') }],
          tab,
        );
        await waitFor(() => {
          expect(screen.getByText(text)).toBeInTheDocument();
        });
        unmount();
      }
    });
  });
});
