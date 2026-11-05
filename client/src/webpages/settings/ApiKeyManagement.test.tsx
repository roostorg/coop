import {
  GQLApiKeysDocument,
  GQLCreateApiKeyDocument,
  GQLUpdateApiKeyDocument,
} from '@/graphql/generated';
import { MockedProvider } from '@apollo/client/testing';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import ApiKeyManagement from './ApiKeyManagement';

describe('ApiKeyManagement', () => {
  it('waits for permission definitions before allowing creation', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: GQLApiKeysDocument },
            delay: 100,
            maxUsageCount: Infinity,
            result: {
              data: {
                apiKeys: [],
                apiKeyPermissions: [
                  {
                    __typename: 'ApiKeyPermissionDefinition',
                    value: 'items:read',
                    description: 'Read items',
                  },
                ],
              },
            },
          },
          {
            request: {
              query: GQLCreateApiKeyDocument,
              variables: {
                input: {
                  name: 'Reports',
                  description: null,
                  permissions: ['items:read'],
                },
              },
            },
            result: {
              data: {
                createApiKey: {
                  __typename: 'CreateApiKeySuccessResponse',
                  apiKey: 'new-secret',
                  record: { __typename: 'ApiKey', id: 'key-1' },
                },
              },
            },
          },
        ]}
      >
        <ApiKeyManagement />
      </MockedProvider>,
    );
    expect(screen.getByText('Loading API keys…')).toBeInTheDocument();
    const createButton = screen.getByRole('button', { name: 'Create key' });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Name'), {
      target: { value: 'Reports' },
    });
    fireEvent.click(dialog.getByRole('checkbox', { name: 'items:read' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Create key' }));
    await waitFor(() =>
      expect(screen.getByLabelText('New API key')).toHaveValue('new-secret'),
    );
  });

  it('keeps creation disabled after a query failure until retry succeeds', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: GQLApiKeysDocument },
            error: new Error('Network unavailable'),
          },
          {
            request: { query: GQLApiKeysDocument },
            result: { data: { apiKeys: [], apiKeyPermissions: [] } },
          },
        ]}
      >
        <ApiKeyManagement />
      </MockedProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load API keys.',
    );
    const createButton = screen.getByRole('button', { name: 'Create key' });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(createButton).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([{ permissions: ['items:write'] }, { permissions: [] }])(
    'edits existing permissions to $permissions',
    async ({ permissions }) => {
      const key = {
        __typename: 'ApiKey',
        id: 'key-1',
        name: 'Reports',
        description: null,
        permissions: ['items:read'],
        createdAt: '2026-01-01T00:00:00Z',
        lastUsedAt: null,
      };
      const definitions = ['items:read', 'items:write'].map((value) => ({
        __typename: 'ApiKeyPermissionDefinition',
        value,
        description: value,
      }));
      render(
        <MockedProvider
          mocks={[
            {
              request: { query: GQLApiKeysDocument },
              result: {
                data: { apiKeys: [key], apiKeyPermissions: definitions },
              },
            },
            {
              request: {
                query: GQLUpdateApiKeyDocument,
                variables: {
                  input: {
                    id: key.id,
                    name: key.name,
                    description: null,
                    permissions,
                  },
                },
              },
              result: {
                data: {
                  updateApiKey: {
                    __typename: 'UpdateApiKeySuccessResponse',
                    record: { ...key, permissions },
                  },
                },
              },
            },
            {
              request: { query: GQLApiKeysDocument },
              result: {
                data: {
                  apiKeys: [{ ...key, permissions }],
                  apiKeyPermissions: definitions,
                },
              },
            },
          ]}
        >
          <ApiKeyManagement />
        </MockedProvider>,
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Edit Reports' }),
      );
      const dialog = within(screen.getByRole('dialog'));
      expect(
        dialog.getByRole('checkbox', { name: 'items:read' }),
      ).toBeChecked();
      expect(
        dialog.getByRole('checkbox', { name: 'items:write' }),
      ).not.toBeChecked();
      fireEvent.click(dialog.getByRole('checkbox', { name: 'items:read' }));
      if (permissions.length)
        fireEvent.click(dialog.getByRole('checkbox', { name: 'items:write' }));
      fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      if (permissions.length) {
        expect(
          within(
            screen.getByRole('list', { name: 'Permissions for Reports' }),
          ).getByText('items:write'),
        ).toBeInTheDocument();
      } else {
        expect(screen.getByText('No permissions')).toBeInTheDocument();
      }
      expect(screen.queryByLabelText('New API key')).not.toBeInTheDocument();
    },
  );

  it.each(['Create key', 'Edit Reports', 'Rotate Reports', 'Delete Reports'])(
    'preserves the new secret when opening and canceling %s',
    async (action) => {
      render(
        <MockedProvider
          mocks={[
            {
              request: { query: GQLApiKeysDocument },
              maxUsageCount: Infinity,
              result: {
                data: {
                  apiKeyPermissions: [],
                  apiKeys: [
                    {
                      __typename: 'ApiKey',
                      id: 'key-1',
                      name: 'Reports',
                      description: null,
                      permissions: [],
                      createdAt: '2026-01-01T00:00:00Z',
                      lastUsedAt: null,
                    },
                  ],
                },
              },
            },
            {
              request: {
                query: GQLCreateApiKeyDocument,
                variables: {
                  input: {
                    name: 'Reports',
                    description: null,
                    permissions: [],
                  },
                },
              },
              result: {
                data: {
                  createApiKey: {
                    __typename: 'CreateApiKeySuccessResponse',
                    apiKey: 'new-secret',
                    record: { __typename: 'ApiKey', id: 'key-1' },
                  },
                },
              },
            },
          ]}
        >
          <ApiKeyManagement />
        </MockedProvider>,
      );
      await screen.findByRole('button', { name: 'Edit Reports' });
      fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'Reports' },
      });
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Create key',
        }),
      );
      await waitFor(() =>
        expect(screen.getByLabelText('New API key')).toHaveValue('new-secret'),
      );

      fireEvent.click(screen.getByRole('button', { name: action }));
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Cancel',
        }),
      );
      expect(screen.getByLabelText('New API key')).toHaveValue('new-secret');

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByLabelText('New API key')).not.toBeInTheDocument();
    },
  );
});
