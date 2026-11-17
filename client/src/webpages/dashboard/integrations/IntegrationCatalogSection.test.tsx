import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import {
  GQLIntegrationCatalogRefreshInterval,
  GQLRefreshIntegrationCatalogDocument,
  type GQLIntegrationCatalogStatus,
} from '../../../graphql/generated';
import IntegrationCatalogSection from './IntegrationCatalogSection';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/coop-ui/Toast', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

function status(
  overrides: Partial<GQLIntegrationCatalogStatus>,
): GQLIntegrationCatalogStatus {
  return {
    __typename: 'IntegrationCatalogStatus',
    status: 'OK' as const,
    version: 'v1',
    signalCount: 4,
    fetchedAt: '2026-09-27T17:00:00.000Z',
    errorMessage: null,
    signals: [],
    ...overrides,
  };
}

function renderSection(
  catalogStatus?: GQLIntegrationCatalogStatus | null,
  canEditConfig = true,
  mocks: MockedResponse[] = [],
) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks}>
        <IntegrationCatalogSection
          integrationId="EXAMPLE"
          catalogStatus={catalogStatus}
          canEditConfig={canEditConfig}
        />
      </MockedProvider>
    </MemoryRouter>,
  );
}

describe('IntegrationCatalogSection', () => {
  it('renders the catalog status states', () => {
    const { rerender } = renderSection(
      status({ status: 'NEVER_REFRESHED', version: null, signalCount: null }),
    );
    expect(screen.getByText('Never refreshed')).toBeInTheDocument();

    rerender(
      <MockedProvider mocks={[]}>
        <IntegrationCatalogSection
          integrationId="EXAMPLE"
          catalogStatus={status({})}
          canEditConfig
        />
      </MockedProvider>,
    );
    expect(screen.getByText(/Up to date · refreshed/)).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();

    rerender(
      <MockedProvider mocks={[]}>
        <IntegrationCatalogSection
          integrationId="EXAMPLE"
          catalogStatus={status({
            status: 'ERROR',
            errorMessage: 'Credentials expired',
          })}
          canEditConfig
        />
      </MockedProvider>,
    );
    expect(
      screen.getByText(/Refresh failed: Credentials expired/),
    ).toBeInTheDocument();
  });

  it('lists catalog signals with their subcategories and a short version', () => {
    const version =
      'sha256:3bfc6c8f340f0fb4e7e6b8ae48eae193c9af0875c012eff84a8f6b6180be3106';
    renderSection(
      status({
        version,
        signals: [
          {
            __typename: 'IntegrationCatalogSignal',
            signalTypeId: 'PIGEON_POLICY_SCORE',
            displayName: 'Pigeon policy score',
            subcategories: [
              {
                __typename: 'IntegrationCatalogSignalSubcategory',
                id: 'harassment',
                label: 'Harassment',
              },
              {
                __typename: 'IntegrationCatalogSignalSubcategory',
                id: 'spam',
                label: 'Spam',
              },
            ],
          },
          {
            __typename: 'IntegrationCatalogSignal',
            signalTypeId: 'OTHER_SIGNAL',
            displayName: 'Other signal',
            subcategories: [],
          },
        ],
      }),
    );

    expect(screen.getByText('Pigeon policy score')).toBeInTheDocument();
    expect(screen.getByText(/2 subcategories/)).toBeInTheDocument();
    expect(screen.getByText('Harassment')).toHaveAttribute(
      'title',
      'harassment',
    );
    expect(screen.getByText('Spam')).toBeInTheDocument();
    expect(screen.getByText(/No subcategories/)).toBeInTheDocument();
    expect(screen.getByText('sha256:3bfc6c8f340f…')).toBeInTheDocument();
    expect(screen.queryByText(version)).not.toBeInTheDocument();
  });

  it('shows the refresh interval and reports a new choice', () => {
    const onRefreshIntervalChange = vi.fn();
    render(
      <MemoryRouter>
        <MockedProvider mocks={[]}>
          <IntegrationCatalogSection
            integrationId="EXAMPLE"
            catalogStatus={status({})}
            refreshInterval={GQLIntegrationCatalogRefreshInterval.Daily}
            onRefreshIntervalChange={onRefreshIntervalChange}
            canEditConfig
          />
        </MockedProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Daily')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('Refresh automatically'));
    fireEvent.click(screen.getByText('Only when refreshed manually'));

    expect(onRefreshIntervalChange).toHaveBeenCalledWith(
      GQLIntegrationCatalogRefreshInterval.Manual,
      expect.anything(),
    );
  });

  it('disables refresh without edit permission', () => {
    renderSection(status({}), false);
    expect(
      screen.getByRole('button', { name: 'Refresh catalog' }),
    ).toBeDisabled();
  });

  it('refreshes the catalog and reports added and removed counts', async () => {
    const mocks = [
      {
        request: {
          query: GQLRefreshIntegrationCatalogDocument,
          variables: { integrationId: 'EXAMPLE' },
        },
        result: {
          data: {
            refreshIntegrationCatalog: {
              __typename: 'RefreshIntegrationCatalogSuccessResponse',
              integrationId: 'EXAMPLE',
              version: 'v2',
              signalCount: 5,
              fetchedAt: '2026-09-27T18:00:00.000Z',
              addedSignalTypeIds: ['NEW_SIGNAL'],
              removedSignalTypeIds: ['OLD_SIGNAL', 'OTHER_SIGNAL'],
            },
          },
        },
      },
    ];

    renderSection(status({}), true, mocks);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh catalog' }));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Catalog refreshed: 1 signal added, 2 removed.',
      ),
    );
  });

  it('reports refresh union errors using the server title', async () => {
    const mocks = [
      {
        request: {
          query: GQLRefreshIntegrationCatalogDocument,
          variables: { integrationId: 'EXAMPLE' },
        },
        result: {
          data: {
            refreshIntegrationCatalog: {
              __typename: 'IntegrationCatalogRefreshError',
              title: 'Catalog unavailable',
              detail: null,
              pointer: null,
              requestId: null,
              status: 503,
              type: ['catalog-unavailable'],
            },
          },
        },
      },
    ];

    renderSection(status({}), true, mocks);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh catalog' }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Catalog unavailable'),
    );
  });
});
