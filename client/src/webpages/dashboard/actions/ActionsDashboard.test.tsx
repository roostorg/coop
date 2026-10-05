import { TooltipProvider } from '@/coop-ui/Tooltip';
import { InMemoryCache } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  GQLActionsDocument,
  GQLActionsQuery,
  GQLUserPenaltySeverity,
} from '../../../graphql/generated';
import ActionsDashboard from './ActionsDashboard';

const cacheOptions = {
  possibleTypes: {
    ActionBase: [
      'CustomAction',
      'EnqueueToMrtAction',
      'EnqueueToNcmecAction',
      'EnqueueAuthorToMrtAction',
    ],
    ItemTypeBase: ['ContentItemType', 'UserItemType', 'ThreadItemType'],
  },
};

const post = {
  __typename: 'ContentItemType',
  id: 'post',
  name: 'Post',
} as const;
const comment = {
  __typename: 'ContentItemType',
  id: 'comment',
  name: 'Comment',
} as const;
const user = { __typename: 'UserItemType', id: 'user', name: 'User' } as const;
const thread = {
  __typename: 'ThreadItemType',
  id: 'thread',
  name: 'Thread',
} as const;

const actionsData: GQLActionsQuery = {
  __typename: 'Query',
  me: { __typename: 'User', permissions: [] },
  myOrg: {
    __typename: 'Org',
    actions: [
      {
        __typename: 'CustomAction',
        id: 'remove-content',
        name: 'Remove content',
        description: 'Remove a post or comment that violates a policy.',
        penalty: GQLUserPenaltySeverity.Medium,
        applyUserStrikes: false,
        itemTypes: [post, comment],
        parameters: [],
      },
      {
        __typename: 'CustomAction',
        id: 'limit-post',
        name: 'Limit post visibility',
        description: 'Reduce distribution of a post.',
        penalty: GQLUserPenaltySeverity.Low,
        applyUserStrikes: false,
        itemTypes: [post],
        parameters: [],
      },
      {
        __typename: 'CustomAction',
        id: 'hide-comment',
        name: 'Hide comment',
        description: 'Hide a comment from public view.',
        penalty: GQLUserPenaltySeverity.Low,
        applyUserStrikes: false,
        itemTypes: [comment],
        parameters: [],
      },
      {
        __typename: 'CustomAction',
        id: 'suspend-user',
        name: 'Suspend user',
        description: 'Temporarily suspend a user account.',
        penalty: GQLUserPenaltySeverity.High,
        applyUserStrikes: false,
        itemTypes: [user],
        parameters: [],
      },
      {
        __typename: 'CustomAction',
        id: 'lock-thread',
        name: 'Lock thread',
        description: 'Prevent new replies in a thread.',
        penalty: GQLUserPenaltySeverity.None,
        applyUserStrikes: false,
        itemTypes: [thread],
        parameters: [],
      },
      {
        __typename: 'CustomAction',
        id: 'unassigned',
        name: 'Unassigned action',
        description: 'An action with no eligible item types.',
        penalty: GQLUserPenaltySeverity.None,
        applyUserStrikes: false,
        itemTypes: [],
        parameters: [],
      },
      {
        __typename: 'EnqueueToMrtAction',
        id: 'manual-review',
        name: 'Send to manual review',
        description: 'Queue any supported item for a moderator.',
        penalty: GQLUserPenaltySeverity.None,
        applyUserStrikes: false,
        itemTypes: [post, comment, user, thread],
      },
      {
        __typename: 'EnqueueAuthorToMrtAction',
        id: 'review-author',
        name: 'Send author to manual review',
        description: 'Queue the author of content for a moderator.',
        penalty: GQLUserPenaltySeverity.None,
        applyUserStrikes: false,
        itemTypes: [post, comment],
      },
    ],
  },
};

async function renderDashboard() {
  render(
    <MockedProvider
      cache={new InMemoryCache(cacheOptions)}
      mocks={[
        {
          request: { query: GQLActionsDocument },
          result: { data: actionsData },
        },
      ]}
    >
      <HelmetProvider>
        <MemoryRouter>
          <TooltipProvider>
            <ActionsDashboard />
          </TooltipProvider>
        </MemoryRouter>
      </HelmetProvider>
    </MockedProvider>,
  );
  await screen.findByText('Remove content');
}

function visibleActionNames() {
  return within(screen.getAllByRole('rowgroup')[1])
    .queryAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
    .sort();
}

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  return screen
    .getByRole('button', { name: 'Save' })
    .closest<HTMLElement>('.absolute')!;
}

async function selectItemType(name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(
    await screen.findByText(name, {
      selector: '.ant-select-item-option-content',
    }),
  );
}

describe('Actions dashboard eligible item types', () => {
  it('shows the complete item-type list in a keyboard-accessible tooltip', async () => {
    await renderDashboard();
    const row = screen.getByText('Send to manual review').closest('tr')!;
    const trigger = within(row).getByText('Post, Comment, User, Thread');
    expect(trigger.tabIndex).toBe(0);
    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Post, Comment, User, Thread',
    );
  });

  it('displays eligible types and filters custom and built-in actions by any selected type', async () => {
    await renderDashboard();
    expect(
      screen.getByRole('columnheader', { name: 'Item types' }),
    ).toBeTruthy();
    expect(
      within(screen.getByText('Remove content').closest('tr')!).getByText(
        'Post, Comment',
      ),
    ).toBeTruthy();
    expect(visibleActionNames()).toHaveLength(8);

    const menu = openFilters();
    fireEvent.click(within(menu).getByText('Item types'));
    await selectItemType('Post');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(visibleActionNames()).toEqual([
      'Limit post visibility',
      'Remove content',
      'Send author to manual review',
      'Send to manual review',
    ]);

    openFilters();
    await selectItemType('User');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(visibleActionNames()).toEqual([
      'Limit post visibility',
      'Remove content',
      'Send author to manual review',
      'Send to manual review',
      'Suspend user',
    ]);

    const chip = screen.getByText('Item types: Post,User');
    fireEvent.click(chip.querySelector('svg')!);
    expect(visibleActionNames()).toHaveLength(8);
  });

  it('combines the item-type filter with a case-insensitive name filter and supports no matches', async () => {
    await renderDashboard();
    const menu = openFilters();
    fireEvent.click(within(menu).getByText('Item types'));
    await selectItemType('Post');
    fireEvent.click(within(menu).getByText('Name'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'REMOVE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(visibleActionNames()).toEqual(['Remove content']);

    openFilters();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'suspend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(visibleActionNames()).toEqual([]);

    const chip = screen.getByText('Item types: Post');
    fireEvent.click(chip.querySelector('svg')!);
    expect(visibleActionNames()).toEqual(['Suspend user']);
  });
});
