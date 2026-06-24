import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLHasNcmecReportingEnabledDocument,
  GQLRolesForOrgDocument,
  GQLUserRole,
} from '@/graphql/generated';

import ManageUsersInviteUserSection from './ManageUsersInviteUserSection';

const ncmecMock: MockedResponse = {
  request: { query: GQLHasNcmecReportingEnabledDocument },
  maxUsageCount: Infinity,
  result: {
    data: {
      myOrg: { __typename: 'Organization', hasNCMECReportingEnabled: false },
    },
  },
};

const rolesMock: MockedResponse = {
  request: { query: GQLRolesForOrgDocument },
  maxUsageCount: Infinity,
  result: {
    data: {
      rolesForOrg: [
        {
          __typename: 'Role',
          id: 'role-1',
          key: GQLUserRole.Admin,
          displayName: 'Admin',
          description: '',
          isSystem: true,
          isFallback: false,
          permissions: [],
          userCount: 1,
        },
      ],
    },
  },
};

function renderSection() {
  return render(
    <MockedProvider mocks={[ncmecMock, rolesMock]}>
      <MemoryRouter>
        <ManageUsersInviteUserSection />
      </MemoryRouter>
    </MockedProvider>,
  );
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /send invite link/i }),
    ).toBeInTheDocument();
  });
}

function getEmailInput() {
  return screen.getByPlaceholderText('Email address');
}

function getSubmitButton() {
  return screen.getByRole('button', { name: /send invite link/i });
}

describe('ManageUsersInviteUserSection', () => {
  it('disables the button with no input', async () => {
    renderSection();
    await waitForLoaded();
    expect(getSubmitButton()).toBeDisabled();
  });

  it('disables the button for a plainly invalid email', async () => {
    renderSection();
    await waitForLoaded();
    fireEvent.change(getEmailInput(), { target: { value: 'notanemail' } });
    expect(getSubmitButton()).toBeDisabled();
  });

  it('disables the button for a comma-separated email list', async () => {
    renderSection();
    await waitForLoaded();
    fireEvent.change(getEmailInput(), {
      target: { value: 'foo@bar.com,baz@qux.com' },
    });
    expect(getSubmitButton()).toBeDisabled();
  });

  it('disables the button when email is valid but no role is selected', async () => {
    renderSection();
    await waitForLoaded();
    fireEvent.change(getEmailInput(), {
      target: { value: 'user@example.com' },
    });
    expect(getSubmitButton()).toBeDisabled();
  });

  it('enables the button with a valid email and a role selected', async () => {
    renderSection();
    await waitForLoaded();
    fireEvent.change(getEmailInput(), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /admin/i }));
    expect(getSubmitButton()).not.toBeDisabled();
  });

  it('marks the email input as invalid and re-enables after correction', async () => {
    renderSection();
    await waitForLoaded();

    fireEvent.change(getEmailInput(), { target: { value: 'bad-email' } });
    expect(getEmailInput()).toHaveClass('ring-red-400');

    fireEvent.change(getEmailInput(), {
      target: { value: 'good@example.com' },
    });
    expect(getEmailInput()).not.toHaveClass('ring-red-400');
  });
});
