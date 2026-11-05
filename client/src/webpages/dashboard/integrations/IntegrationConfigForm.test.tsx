import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

import {
  GQLIntegrationConfigFieldInputType,
  GQLUserPermission,
  type GQLIntegrationConfigQuery,
  type GQLPluginIntegrationApiCredential,
  type GQLZentropiLabelerVersion,
  type useGQLSetIntegrationConfigMutation,
  type useGQLSetPluginIntegrationConfigMutation,
} from '../../../graphql/generated';
import IntegrationConfigForm from './IntegrationConfigForm';

const setConfig =
  vi.fn<ReturnType<typeof useGQLSetIntegrationConfigMutation>[0]>();
const setPluginConfig =
  vi.fn<ReturnType<typeof useGQLSetPluginIntegrationConfigMutation>[0]>();
let configData: GQLIntegrationConfigQuery;
let permissions: GQLUserPermission[];

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLIntegrationConfigQuery: () => ({ loading: false, data: configData }),
  useGQLPermissionGatedRouteLoggedInUserQuery: () => ({
    loading: false,
    data: { me: { permissions } },
  }),
  useGQLSetIntegrationConfigMutation: () => [setConfig, { loading: false }],
  useGQLSetPluginIntegrationConfigMutation: () => [
    setPluginConfig,
    { loading: false },
  ],
}));

function renderForm(labelerVersions: GQLZentropiLabelerVersion[]) {
  configData = {
    __typename: 'Query',
    integrationConfig: {
      __typename: 'IntegrationConfigSuccessResult',
      config: {
        __typename: 'IntegrationConfig',
        name: 'ZENTROPI',
        title: 'Zentropi',
        docsUrl: 'https://zentropi.ai/api',
        requiresConfig: true,
        configurationFields: [],
        logoUrl: null,
        logoWithBackgroundUrl: null,
        modelCard: {
          __typename: 'ModelCard',
          modelName: 'CoPE',
          version: '1',
          releaseDate: null,
          sections: [],
        },
        modelCardLearnMoreUrl: null,
        apiCredential: {
          __typename: 'ZentropiIntegrationApiCredential',
          apiKey: 'test-api-key',
          labelerVersions,
        },
      },
    },
  };
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/integrations/zentropi']}>
        <Routes>
          <Route
            path="/integrations/:name"
            element={<IntegrationConfigForm />}
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('Zentropi integration configuration', () => {
  beforeEach(() => {
    setConfig.mockReset().mockResolvedValue({});
    permissions = [GQLUserPermission.ManageOrg];
  });

  it.each([null, '', 'lb_123'])(
    'saves the existing version unchanged with labeler ID %j',
    (labelerId) => {
      renderForm([
        {
          __typename: 'ZentropiLabelerVersion',
          id: 'lv_123',
          label: 'Spam',
          labelerId,
        },
      ]);

      expect(screen.getByPlaceholderText('Labeler ID (optional)')).toHaveValue(
        labelerId ?? '',
      );
      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      expect(setConfig).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          variables: {
            input: {
              apiCredential: {
                zentropi: {
                  apiKey: 'test-api-key',
                  labelerVersions: [{ id: 'lv_123', label: 'Spam', labelerId }],
                },
              },
            },
          },
        }),
      );
    },
  );

  it('saves a new version without a labeler ID but still requires its ID and name', () => {
    renderForm([]);
    // API-key-only setup remains valid; empty new rows do not.
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Labeler Version' }),
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Version ID'), {
      target: { value: 'lv_new' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Labeler Name'), {
      target: { value: 'New version' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(setConfig).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        variables: {
          input: {
            apiCredential: {
              zentropi: {
                apiKey: 'test-api-key',
                labelerVersions: [
                  { id: 'lv_new', label: 'New version', labelerId: '' },
                ],
              },
            },
          },
        },
      }),
    );
    fireEvent.change(screen.getByPlaceholderText('Version ID'), {
      target: { value: '' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('still requires an API key', () => {
    renderForm([]);
    fireEvent.change(screen.getByDisplayValue('test-api-key'), {
      target: { value: '' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not enable saving without permission to manage the org', () => {
    permissions = [];
    renderForm([
      { __typename: 'ZentropiLabelerVersion', id: 'lv_123', label: 'Spam' },
    ]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

function renderPluginForm(
  credential: GQLPluginIntegrationApiCredential['credential'],
) {
  configData = {
    __typename: 'Query',
    integrationConfig: {
      __typename: 'IntegrationConfigSuccessResult',
      config: {
        __typename: 'IntegrationConfig',
        name: 'PIGEON',
        title: 'Pigeon',
        docsUrl: 'https://example.com/docs',
        requiresConfig: true,
        configurationFields: [
          {
            __typename: 'IntegrationConfigField',
            key: 'apiKey',
            label: 'API key',
            required: true,
            inputType: GQLIntegrationConfigFieldInputType.Password,
            options: null,
            placeholder: null,
            description: null,
          },
          {
            __typename: 'IntegrationConfigField',
            key: 'headers',
            label: 'Headers',
            required: false,
            inputType: GQLIntegrationConfigFieldInputType.Json,
            options: null,
            placeholder: null,
            description: null,
          },
        ],
        logoUrl: null,
        logoWithBackgroundUrl: null,
        modelCard: {
          __typename: 'ModelCard',
          modelName: 'Pigeon',
          version: '1',
          releaseDate: null,
          sections: [],
        },
        modelCardLearnMoreUrl: null,
        apiCredential: {
          __typename: 'PluginIntegrationApiCredential',
          credential,
        },
      },
    },
  };
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/integrations/pigeon']}>
        <Routes>
          <Route
            path="/integrations/:name"
            element={<IntegrationConfigForm />}
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('Plugin integration configuration', () => {
  beforeEach(() => {
    setPluginConfig.mockReset().mockResolvedValue({});
    permissions = [GQLUserPermission.ManageOrg];
  });

  it('saves JSON fields as parsed values and omits blank optional fields', () => {
    renderPluginForm({ apiKey: 'test-api-key' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Headers'), {
      target: { value: '{"X-Team":"trust"}' },
    });
    fireEvent.click(save);

    expect(setPluginConfig).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        variables: {
          input: {
            integrationId: 'PIGEON',
            credential: {
              apiKey: 'test-api-key',
              headers: { 'X-Team': 'trust' },
            },
          },
        },
      }),
    );
  });

  it.each([['trust'], ['true'], [true], [[]], [[null]], [{ team: 'trust' }]])(
    'round-trips a saved JSON value %j unchanged',
    (headers) => {
      renderPluginForm({ apiKey: 'test-api-key', headers });

      expect(screen.getByLabelText('Headers')).toHaveValue(
        JSON.stringify(headers),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(setPluginConfig).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          variables: {
            input: {
              integrationId: 'PIGEON',
              credential: { apiKey: 'test-api-key', headers },
            },
          },
        }),
      );
    },
  );

  it('blocks saving invalid JSON and missing required fields', () => {
    renderPluginForm({ apiKey: 'test-api-key' });
    fireEvent.change(screen.getByLabelText('Headers'), {
      target: { value: '{not json' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Headers'), {
      target: { value: '' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/API key/), {
      target: { value: '' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
