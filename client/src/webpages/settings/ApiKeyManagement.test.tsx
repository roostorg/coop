import {
  GQLApiKeysDocument,
  GQLCreateApiKeyDocument,
  GQLRevokeApiKeyDocument,
  GQLRotateApiKeyDocument,
} from '@/graphql/generated';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ApiKeyManagement from './ApiKeyManagement';

const traffic = {
  __typename: 'ApiKey',
  id: 'traffic',
  name: 'Traffic ingestion',
  description: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  lastUsedAt: null,
};
const reports = { ...traffic, id: 'reports', name: 'Reports' };
const list = (keys = [traffic, reports]): MockedResponse => ({
  request: { query: GQLApiKeysDocument },
  result: { data: { apiKeys: keys } },
});

function mount(mocks: MockedResponse[]) {
  render(
    <MockedProvider mocks={mocks}>
      <ApiKeyManagement />
    </MockedProvider>,
  );
  return userEvent;
}

it('creates a named key without replacing existing keys and displays its secret only until dismissed', async () => {
  const created = { ...traffic, id: 'new', name: 'Appeals' };
  const user = mount([
    list(),
    {
      request: {
        query: GQLCreateApiKeyDocument,
        variables: { input: { name: 'Appeals', description: null } },
      },
      result: {
        data: {
          createApiKey: {
            __typename: 'CreateApiKeySuccessResponse',
            apiKey: 'test-only-secret',
            record: { __typename: 'ApiKey', id: 'new' },
          },
        },
      },
    },
    list([created, traffic, reports]),
  ]);
  await screen.findByText('Traffic ingestion');
  await user.click(screen.getByRole('button', { name: 'Create key' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByRole('button', { name: 'Create key' })).toBeDisabled();
  await user.type(dialog.getByLabelText('Name'), 'Appeals');
  await user.click(dialog.getByRole('button', { name: 'Create key' }));
  expect(await screen.findByLabelText('New API key')).toHaveValue(
    'test-only-secret',
  );
  await screen.findByText('Appeals');
  expect(
    screen.getByRole('button', { name: 'Rotate Traffic ingestion' }),
  ).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Rotate Reports' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByLabelText('New API key')).not.toBeInTheDocument();
});

it('rotates the selected key after confirmation and leaves its neighbor available', async () => {
  const user = mount([
    list(),
    {
      request: {
        query: GQLRotateApiKeyDocument,
        variables: {
          input: { id: 'reports', name: 'Reports', description: null },
        },
      },
      result: {
        data: {
          rotateApiKey: {
            __typename: 'RotateApiKeySuccessResponse',
            apiKey: 'replacement-secret',
            record: { ...reports, createdBy: null },
          },
        },
      },
    },
    list(),
  ]);
  await user.click(
    await screen.findByRole('button', { name: 'Rotate Reports' }),
  );
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Other keys are not affected.',
  );
  expect(screen.queryByLabelText('New API key')).not.toBeInTheDocument();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Rotate key',
    }),
  );
  expect(await screen.findByLabelText('New API key')).toHaveValue(
    'replacement-secret',
  );
  expect(
    screen.getByRole('button', { name: 'Rotate Traffic ingestion' }),
  ).toBeEnabled();
});

it('can cancel revocation, then revoke only the selected key', async () => {
  const user = mount([
    list(),
    {
      request: { query: GQLRevokeApiKeyDocument, variables: { id: 'reports' } },
      result: { data: { revokeApiKey: true } },
    },
    list([traffic, { ...reports, isActive: false }]),
  ]);
  await user.click(
    await screen.findByRole('button', { name: 'Revoke Reports' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
  );
  expect(screen.getByRole('button', { name: 'Revoke Reports' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Revoke Reports' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Revoke key',
    }),
  );
  await waitFor(() =>
    expect(screen.getByText('Reports · Revoked')).toBeInTheDocument(),
  );
  expect(
    screen.queryByRole('button', { name: 'Revoke Reports' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Revoke Traffic ingestion' }),
  ).toBeEnabled();
});

it('keeps a failed creation form open with the entered name', async () => {
  const user = mount([
    list([]),
    {
      request: {
        query: GQLCreateApiKeyDocument,
        variables: { input: { name: 'Reports', description: null } },
      },
      error: new Error('Request failed'),
    },
  ]);
  await screen.findByText(
    'No API keys. Create a key to connect an integration.',
  );
  await user.click(screen.getByRole('button', { name: 'Create key' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByLabelText('Name'), 'Reports');
  await user.click(dialog.getByRole('button', { name: 'Create key' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  expect(dialog.getByLabelText('Name')).toHaveValue('Reports');
});
