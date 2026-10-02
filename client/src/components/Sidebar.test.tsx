import { TooltipProvider } from '@/coop-ui/Tooltip';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import { GQLUserPermission } from '@/graphql/generated';
import { vi } from 'vitest';

import Sidebar, { type MenuItem } from './Sidebar';

const menuItems: MenuItem[] = [
  {
    title: 'Overview',
    urlPath: 'overview',
    requiredPermissions: [],
  },
  {
    title: 'Review Console',
    urlPath: 'manual_review',
    requiredPermissions: [],
  },
];

const settingsMenuItems: MenuItem[] = [
  {
    title: 'Settings',
    urlPath: 'settings',
    requiredPermissions: [],
    subItems: [
      {
        title: 'Item Types',
        urlPath: 'item_types',
        requiredPermissions: [GQLUserPermission.ManageOrg],
      },
      {
        title: 'Actions',
        urlPath: 'actions',
        requiredPermissions: [GQLUserPermission.ManageOrg],
      },
      {
        title: 'Users',
        urlPath: 'users',
        requiredPermissions: [GQLUserPermission.ManageOrg],
      },
      {
        title: 'Settings',
        urlPath: '',
        requiredPermissions: [GQLUserPermission.ManageOrg],
      },
    ],
  },
];

const allPermissions = [GQLUserPermission.ManageOrg];

function renderSidebar(
  initialPath = '/dashboard/overview',
  selectedMenuItem: string | null = null,
  overrides: {
    permissions?: GQLUserPermission[];
  } = {},
) {
  const setSelectedMenuItem = vi.fn();
  const logout = vi.fn();

  const result = render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar
          menuItems={menuItems}
          settingsMenuItems={settingsMenuItems}
          selectedMenuItem={selectedMenuItem}
          setSelectedMenuItem={setSelectedMenuItem}
          permissions={overrides.permissions ?? allPermissions}
          logout={logout}
        />
      </MemoryRouter>
    </TooltipProvider>,
  );

  return { ...result, setSelectedMenuItem, logout };
}

function getSettingsButton() {
  return screen.queryByRole('button', { name: 'Settings' });
}

// Non-null variant for the cases where the button is always present (i.e. every
// test except the "not in the document" one).
function getSettingsButtonEl() {
  return screen.getByRole('button', { name: 'Settings' });
}

describe('Sidebar', () => {
  it('renders main menu items and footer links', () => {
    renderSidebar();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Review Console')).toBeInTheDocument();
    expect(getSettingsButton()).toBeInTheDocument();
  });

  it('shows settings sub-items when on a settings page', () => {
    renderSidebar('/dashboard/settings', 'Settings');
    expect(screen.getByText('Item Types')).toBeVisible();
    expect(screen.getByText('Actions')).toBeVisible();
    expect(screen.getByText('Users')).toBeVisible();
  });

  it('hides settings sub-items when not on a settings page', () => {
    renderSidebar('/dashboard/overview', 'Overview');
    const itemTypes = screen.getByText('Item Types');
    const parent = itemTypes.closest('[class*="overflow-hidden"]');
    expect(parent).toHaveClass('max-h-0');
  });

  it('highlights gear icon on settings pages but not elsewhere', () => {
    const { unmount } = renderSidebar('/dashboard/settings', 'Settings');
    expect(getSettingsButton()).toHaveClass('text-primary');
    unmount();

    renderSidebar('/dashboard/overview', 'Overview');
    expect(getSettingsButton()).not.toHaveClass('text-primary');
  });

  it('expands settings sub-items when gear icon is clicked', () => {
    renderSidebar('/dashboard/overview', 'Overview');
    const settingsButton = getSettingsButtonEl();
    expect(settingsButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(settingsButton);

    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses a gear-opened settings submenu when clicking outside the sidebar', () => {
    renderSidebar('/dashboard/overview', 'Overview');
    fireEvent.click(getSettingsButtonEl());
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(document.body);

    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the submenu open when clicking the gear toggle or a sub-item', () => {
    renderSidebar('/dashboard/overview', 'Overview');
    fireEvent.click(getSettingsButtonEl());
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(getSettingsButtonEl());
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(screen.getByText('Item Types'));
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses the submenu when clicking its own empty padding', () => {
    renderSidebar('/dashboard/overview', 'Overview');
    fireEvent.click(getSettingsButtonEl());
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');

    // The panel that wraps the sub-item list, but outside the list itself.
    const panel = screen
      .getByText('Item Types')
      .closest('[class*="overflow-hidden"]');
    if (panel == null) {
      throw new Error('settings submenu panel not found');
    }
    fireEvent.pointerDown(panel);

    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses a gear-opened settings submenu when navigating to another page', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <Sidebar
              menuItems={menuItems}
              settingsMenuItems={settingsMenuItems}
              selectedMenuItem="Overview"
              setSelectedMenuItem={vi.fn()}
              permissions={allPermissions}
              logout={vi.fn()}
            />
          ),
        },
      ],
      { initialEntries: ['/dashboard/overview'] },
    );
    render(
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>,
    );

    // Open via the gear button while on a non-settings route (no settings route
    // was ever visited).
    fireEvent.click(getSettingsButtonEl());
    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      await router.navigate('/dashboard/manual_review');
    });

    expect(getSettingsButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses settings sub-items after navigating away from Settings', () => {
    const props = {
      menuItems,
      settingsMenuItems,
      setSelectedMenuItem: vi.fn(),
      permissions: allPermissions,
      logout: vi.fn(),
    };
    let selectedMenuItem = 'Settings';
    const tree = () => (
      <TooltipProvider>
        <MemoryRouter initialEntries={['/dashboard/settings']}>
          <Sidebar {...props} selectedMenuItem={selectedMenuItem} />
        </MemoryRouter>
      </TooltipProvider>
    );

    const { rerender } = render(tree());
    const subItemContainer = screen
      .getByText('Item Types')
      .closest('[class*="overflow-hidden"]');
    expect(subItemContainer).not.toHaveClass('max-h-0');

    selectedMenuItem = 'Overview';
    rerender(tree());
    expect(subItemContainer).toHaveClass('max-h-0');
  });

  describe('path-based menu selection', () => {
    it.each([
      ['/dashboard/overview', 'Overview'],
      ['/dashboard/settings', 'Settings'],
      ['/dashboard/settings/item_types', 'Item Types'],
      ['/dashboard/settings/actions', 'Actions'],
    ])('%s → %s', (path, expected) => {
      const { setSelectedMenuItem } = renderSidebar(path);
      expect(setSelectedMenuItem).toHaveBeenCalledWith(expected);
    });
  });

  it('hides gear icon when user lacks ManageOrg permission', () => {
    renderSidebar('/dashboard/overview', 'Overview', { permissions: [] });
    expect(getSettingsButton()).not.toBeInTheDocument();
  });

  it('hides sub-items when user lacks permissions', () => {
    renderSidebar('/dashboard/settings', 'Settings', { permissions: [] });
    expect(screen.queryByText('Item Types')).not.toBeInTheDocument();
  });
});
