import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLPermissionGroupsDocument,
  GQLUserPermission,
  GQLUserRole,
} from '@/graphql/generated';

import PermissionsMatrixModal from './PermissionsMatrixModal';

const missingDescriptionWarning =
  'Missing Description or aria-describedby={undefined} for {DialogContent}';

const permissionGroupsMock: MockedResponse = {
  request: { query: GQLPermissionGroupsDocument },
  result: {
    data: {
      permissionGroups: [
        {
          __typename: 'PermissionGroup',
          key: 'organization',
          label: 'Organization',
          description: 'Organization permissions',
          permissions: [
            {
              __typename: 'PermissionDefinition',
              permission: GQLUserPermission.ManageUsers,
              label: 'Manage users',
              description: 'Invite and manage organization users',
            },
          ],
        },
      ],
    },
  },
};

describe('PermissionsMatrixModal', () => {
  it('associates its explanatory copy with the dialog without a missing-description warning', async () => {
    const targetWarnings: unknown[][] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      if (args.some((arg) => String(arg).includes(missingDescriptionWarning))) {
        targetWarnings.push(args);
        return;
      }
      throw new Error(`Unexpected console.warn: ${args.map(String).join(' ')}`);
    });
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        if (
          args.some((arg) => String(arg).includes(missingDescriptionWarning))
        ) {
          targetWarnings.push(args);
          return;
        }
        if (
          args.some((arg) =>
            String(arg).includes(
              'ReactDOM.render is no longer supported in React 18',
            ),
          )
        ) {
          return;
        }
        throw new Error(
          `Unexpected console.error: ${args.map(String).join(' ')}`,
        );
      });

    try {
      render(
        <MockedProvider mocks={[permissionGroupsMock]}>
          <PermissionsMatrixModal
            roles={[
              {
                key: GQLUserRole.Admin,
                displayName: 'Administrator',
                permissions: [GQLUserPermission.ManageUsers],
                userCount: 2,
              },
            ]}
            onClose={vi.fn()}
          />
        </MockedProvider>,
      );

      const dialog = screen.getByRole('dialog', {
        name: 'Permissions Overview',
      });
      expect(dialog).toHaveAccessibleDescription(
        'Overview of which permissions are granted to each role. Changes to role permissions affect all users with that role.',
      );

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });
      expect(screen.getByText('Manage users')).toBeInTheDocument();
      expect(
        screen.getByRole('img', {
          name: 'Administrator has Manage users',
        }),
      ).toBeInTheDocument();
      expect(targetWarnings).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
