import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLActionParameterType,
  GQLItemTypeHiddenFieldsDocument,
  GQLPersonalSafetySettingsDocument,
  GQLUserPenaltySeverity,
} from '@/graphql/generated';

import ContentRelatedItemComponent, {
  AdditionalReportedContentItems,
  relatedActionForContentItem,
  summarizeActionParameterValues,
} from './ContentRelatedItemComponent';

const contentTypeId = 'content_type';
const userTypeId = 'user_type';

const item = {
  id: 'post_1',
  data: { body: 'hello world' },
  type: {
    id: contentTypeId,
    name: 'Post',
    baseFields: [
      {
        name: 'body',
        type: 'STRING' as const,
        required: true,
        container: null,
      },
    ],
  },
};

const hideContentAction = {
  __typename: 'CustomAction',
  id: 'hide_content',
  name: 'Hide Content',
  penalty: GQLUserPenaltySeverity.High,
  itemTypes: [{ id: contentTypeId, name: 'Post' }],
};

const deleteContentAction = {
  __typename: 'CustomAction',
  id: 'delete_content',
  name: 'Delete',
  penalty: GQLUserPenaltySeverity.Severe,
  itemTypes: [{ id: contentTypeId, name: 'Post' }],
};

const banUserAction = {
  __typename: 'CustomAction',
  id: 'ban_user',
  name: 'Ban User',
  penalty: GQLUserPenaltySeverity.Severe,
  itemTypes: [{ id: userTypeId, name: 'User' }],
};

const policies = [
  { id: 'policy_spam', name: 'Spam' },
  { id: 'policy_abuse', name: 'Abuse' },
];

const hideEnqueued = relatedActionForContentItem({
  item,
  displayName: 'Post (post_1)',
  action: hideContentAction,
  selectedPolicyIds: 'policy_spam',
  allPolicies: policies,
});

const apolloMocks = [
  {
    request: { query: GQLItemTypeHiddenFieldsDocument },
    result: {
      data: {
        myOrg: {
          __typename: 'Org',
          itemTypes: [
            {
              __typename: 'ContentItemType',
              id: contentTypeId,
              hiddenFields: [],
            },
          ],
        },
      },
    },
  },
  {
    request: { query: GQLPersonalSafetySettingsDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          interfacePreferences: {
            __typename: 'UserInterfacePreferences',
            moderatorSafetyMuteVideo: true,
            moderatorSafetyGrayscale: false,
            moderatorSafetyBlurLevel: 2,
            moderatorSafetySepia: false,
          },
        },
      },
    },
  },
];

function renderContentItem(
  overrides: Partial<
    React.ComponentProps<typeof ContentRelatedItemComponent>
  > = {},
) {
  return render(
    <MockedProvider mocks={apolloMocks}>
      <ContentRelatedItemComponent
        item={item}
        title="Post"
        unblurAllMedia
        allActions={[hideContentAction, deleteContentAction, banUserAction]}
        allPolicies={policies}
        relatedActions={[]}
        onEnqueueAction={() => {}}
        onRemoveAction={() => {}}
        isActionable
        requirePolicySelectionToEnqueueAction={false}
        allowMoreThanOnePolicySelection={false}
        {...overrides}
      />
    </MockedProvider>,
  );
}

async function openActionSelect() {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  await waitFor(() => {
    expect(screen.getByText('Hide Content')).toBeInTheDocument();
  });
}

describe('summarizeActionParameterValues', () => {
  const parameters = [
    {
      name: 'reason',
      displayName: 'Reason',
      type: GQLActionParameterType.String,
      options: null,
    },
    {
      name: 'queue',
      displayName: 'Queue',
      type: GQLActionParameterType.Select,
      options: [
        {
          __typename: 'ActionParameterOption' as const,
          value: 'human',
          label: 'Human Review',
        },
        {
          __typename: 'ActionParameterOption' as const,
          value: 'ncmec',
          label: 'NCMEC',
        },
      ],
    },
    {
      name: 'notify',
      displayName: 'Notify user',
      type: GQLActionParameterType.Boolean,
      options: null,
    },
  ];

  it('formats saved parameter values for display', () => {
    expect(
      summarizeActionParameterValues(parameters, {
        reason: 'spam',
        queue: 'human',
        notify: true,
      }),
    ).toEqual([
      { label: 'Reason', formatted: 'spam' },
      { label: 'Queue', formatted: 'Human Review' },
      { label: 'Notify user', formatted: 'Yes' },
    ]);
  });

  it('omits empty values', () => {
    expect(
      summarizeActionParameterValues(parameters, { reason: '', notify: false }),
    ).toEqual([{ label: 'Notify user', formatted: 'No' }]);
  });
});

describe('relatedActionForContentItem', () => {
  it('targets the content item and attaches selected policies', () => {
    expect(hideEnqueued).toEqual({
      action: {
        id: 'hide_content',
        name: 'Hide Content',
        penalty: GQLUserPenaltySeverity.High,
      },
      policies: [{ id: 'policy_spam', name: 'Spam' }],
      target: {
        identifier: { itemId: 'post_1', itemTypeId: contentTypeId },
        displayName: 'Post (post_1)',
      },
    });
  });

  it('preserves previously saved action parameters', () => {
    expect(
      relatedActionForContentItem({
        item,
        displayName: 'Post (post_1)',
        action: hideContentAction,
        selectedPolicyIds: 'policy_spam',
        allPolicies: policies,
        customMrtApiParamDecisionPayload: { note: 'keep me' },
      }).customMrtApiParamDecisionPayload,
    ).toEqual({ note: 'keep me' });
  });
});

describe('ContentRelatedItemComponent', () => {
  it('offers content-type actions in a dropdown and hides user-type actions', async () => {
    renderContentItem();
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    expect(screen.getByText('Take Action on This Item')).toBeInTheDocument();
    expect(screen.getByText('Select an action')).toBeInTheDocument();
    await openActionSelect();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Ban User')).not.toBeInTheDocument();
  });

  it('does not show the action picker when the item is not actionable', async () => {
    renderContentItem({ isActionable: false });
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    expect(screen.queryByText('Select an action')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Take Action on This Item'),
    ).not.toBeInTheDocument();
  });

  it('enqueues a selected action and shows it as active', async () => {
    const onEnqueueAction = vi.fn();
    renderContentItem({ onEnqueueAction });
    await waitFor(() => {
      expect(screen.getByText('Select an action')).toBeInTheDocument();
    });
    await openActionSelect();
    fireEvent.click(screen.getByText('Hide Content'));
    expect(onEnqueueAction).toHaveBeenCalledWith({
      action: {
        id: 'hide_content',
        name: 'Hide Content',
        penalty: GQLUserPenaltySeverity.High,
      },
      policies: [],
      target: {
        identifier: { itemId: 'post_1', itemTypeId: contentTypeId },
        displayName: 'Post (post_1)',
      },
    });
  });

  it('enqueues a selected action immediately when a policy is required', async () => {
    const onEnqueueAction = vi.fn();
    renderContentItem({
      onEnqueueAction,
      requirePolicySelectionToEnqueueAction: true,
    });
    await waitFor(() => {
      expect(screen.getByText('Select an action')).toBeInTheDocument();
    });
    await openActionSelect();
    fireEvent.click(screen.getByText('Hide Content'));
    expect(onEnqueueAction).toHaveBeenCalledWith({
      action: {
        id: 'hide_content',
        name: 'Hide Content',
        penalty: GQLUserPenaltySeverity.High,
      },
      policies: [],
      target: {
        identifier: { itemId: 'post_1', itemTypeId: contentTypeId },
        displayName: 'Post (post_1)',
      },
    });
  });

  it('marks a queued action when a required policy is still missing', async () => {
    renderContentItem({
      relatedActions: [
        relatedActionForContentItem({
          item,
          displayName: 'Post (post_1)',
          action: hideContentAction,
          selectedPolicyIds: [],
          allPolicies: policies,
        }),
      ],
      requirePolicySelectionToEnqueueAction: true,
    });
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    expect(screen.getByText('Policy required')).toBeInTheDocument();
    expect(screen.getByText('Add another action')).toBeInTheDocument();
  });

  it('re-enqueues a queued action when the reviewer changes its policy', async () => {
    const onEnqueueAction = vi.fn();
    renderContentItem({
      relatedActions: [
        relatedActionForContentItem({
          item,
          displayName: 'Post (post_1)',
          action: hideContentAction,
          selectedPolicyIds: 'policy_spam',
          allPolicies: policies,
          customMrtApiParamDecisionPayload: { queue: 'priority' },
        }),
      ],
      onEnqueueAction,
    });
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByTitle('Spam'));
    await waitFor(() => {
      expect(screen.getByText('Abuse')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Abuse'));
    expect(onEnqueueAction).toHaveBeenCalledWith({
      action: {
        id: 'hide_content',
        name: 'Hide Content',
        penalty: GQLUserPenaltySeverity.High,
      },
      policies: [{ id: 'policy_abuse', name: 'Abuse' }],
      target: {
        identifier: { itemId: 'post_1', itemTypeId: contentTypeId },
        displayName: 'Post (post_1)',
      },
      customMrtApiParamDecisionPayload: { queue: 'priority' },
    });
  });

  it('shows an active action as selected and lets the reviewer remove it', async () => {
    const onRemoveAction = vi.fn();
    renderContentItem({
      relatedActions: [hideEnqueued],
      onRemoveAction,
    });
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Remove Hide Content' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Add another action')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Hide Content' }),
    );
    expect(onRemoveAction).toHaveBeenCalledWith(hideEnqueued);
  });

  it('shows saved action parameter values and lets the reviewer edit them', async () => {
    const onEditParameters = vi.fn();
    const enqueueHumanReview = {
      ...relatedActionForContentItem({
        item,
        displayName: 'Post (post_1)',
        action: {
          ...hideContentAction,
          id: 'enqueue_human',
          name: 'Enqueue for Human Review',
        },
        selectedPolicyIds: [],
        allPolicies: policies,
        customMrtApiParamDecisionPayload: { queue: 'priority' },
      }),
    };
    renderContentItem({
      allActions: [
        {
          ...hideContentAction,
          id: 'enqueue_human',
          name: 'Enqueue for Human Review',
          parameters: [
            {
              __typename: 'ActionParameter',
              name: 'queue',
              displayName: 'Queue',
              type: GQLActionParameterType.Select,
              required: true,
              options: [
                {
                  __typename: 'ActionParameterOption',
                  value: 'priority',
                  label: 'Priority',
                },
                {
                  __typename: 'ActionParameterOption',
                  value: 'default',
                  label: 'Default',
                },
              ],
              description: null,
              defaultValue: null,
              min: null,
              max: null,
              maxLength: null,
            },
          ],
        },
      ],
      relatedActions: [enqueueHumanReview],
      onEditParameters,
    });
    await waitFor(() => {
      expect(screen.getByText(/Queue:/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Priority/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edit details for Enqueue for Human Review',
      }),
    );
    expect(onEditParameters).toHaveBeenCalledWith(enqueueHumanReview);
  });
});

describe('AdditionalReportedContentItems', () => {
  it('renders a heading and skips excluded items', async () => {
    render(
      <MockedProvider mocks={apolloMocks}>
        <AdditionalReportedContentItems
          items={[
            item,
            {
              ...item,
              id: 'post_2',
              data: { body: 'other post' },
            },
          ]}
          excludeItems={[{ id: 'post_1', typeId: contentTypeId }]}
          unblurAllMedia
          allActions={[hideContentAction]}
          allPolicies={policies}
          relatedActions={[]}
          onEnqueueAction={() => {}}
          isActionable
          requirePolicySelectionToEnqueueAction={false}
          allowMoreThanOnePolicySelection={false}
        />
      </MockedProvider>,
    );
    await waitFor(() => {
      expect(
        screen.getByText('Additional Items In This Report'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('other post')).toBeInTheDocument();
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
  });

  it('does not exclude an item whose id matches a different type', async () => {
    render(
      <MockedProvider mocks={apolloMocks}>
        <AdditionalReportedContentItems
          items={[item]}
          excludeItems={[{ id: 'post_1', typeId: userTypeId }]}
          unblurAllMedia
          allActions={[hideContentAction]}
          allPolicies={policies}
          relatedActions={[]}
          onEnqueueAction={() => {}}
          isActionable
          requirePolicySelectionToEnqueueAction={false}
          allowMoreThanOnePolicySelection={false}
        />
      </MockedProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
  });

  it('renders nothing when every item is excluded', () => {
    const { container } = render(
      <MockedProvider mocks={apolloMocks}>
        <AdditionalReportedContentItems
          items={[item]}
          excludeItems={[{ id: 'post_1', typeId: contentTypeId }]}
          unblurAllMedia
          allActions={[hideContentAction]}
          allPolicies={policies}
          relatedActions={[]}
          onEnqueueAction={() => {}}
          isActionable
          requirePolicySelectionToEnqueueAction={false}
          allowMoreThanOnePolicySelection={false}
        />
      </MockedProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
