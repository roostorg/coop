import {
  GQLApiKeysDocument,
  GQLCreateApiKeyDocument,
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
                  apiKeys: [
                    {
                      __typename: 'ApiKey',
                      id: 'key-1',
                      name: 'Reports',
                      description: null,
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
                variables: { input: { name: 'Reports', description: null } },
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
