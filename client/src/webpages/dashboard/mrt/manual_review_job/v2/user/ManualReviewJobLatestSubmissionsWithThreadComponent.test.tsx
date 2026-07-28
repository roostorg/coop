import { ApolloLink, InMemoryCache } from '@apollo/client';
import {
  MockedProvider,
  MockedResponse,
  MockLink,
} from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLFieldType,
  GQLGetLatestUserSubmittedItemsDocument,
  GQLGetLatestUserSubmittedItemsQuery,
  GQLItemTypeHiddenFieldsDocument,
  GQLPersonalSafetySettingsDocument,
} from '@/graphql/generated';

import ManualReviewJobLatestSubmissionsWithThreadComponent from './ManualReviewJobLatestSubmissionsWithThreadComponent';

const userIdentifier = { id: 'user-1', typeId: 'user-type' };
const cache = new InMemoryCache({
  possibleTypes: {
    ItemTypeBase: ['ContentItemType', 'ThreadItemType', 'UserItemType'],
  },
});

cache.writeQuery({
  query: GQLItemTypeHiddenFieldsDocument,
  data: {
    __typename: 'Query',
    myOrg: {
      __typename: 'Org',
      itemTypes: [
        {
          __typename: 'ContentItemType',
          id: 'content-type',
          hiddenFields: [],
        },
      ],
    },
  },
});

cache.writeQuery({
  query: GQLPersonalSafetySettingsDocument,
  data: {
    __typename: 'Query',
    me: {
      __typename: 'User',
      interfacePreferences: {
        __typename: 'UserInterfacePreferences',
        moderatorSafetyMuteVideo: true,
        moderatorSafetyGrayscale: false,
        moderatorSafetyBlurLevel: 0,
        moderatorSafetySepia: false,
      },
    },
  },
});

function makeSubmission(
  id: string,
  text: string,
): GQLGetLatestUserSubmittedItemsQuery['latestItemsCreatedBy'][number] {
  return {
    __typename: 'ItemSubmissions',
    latest: {
      __typename: 'ContentItem',
      id,
      submissionId: `submission-${id}`,
      data: { text },
      type: {
        __typename: 'ContentItemType',
        id: 'content-type',
        name: 'History Content',
        baseFields: [
          {
            __typename: 'BaseField',
            name: 'text',
            type: GQLFieldType.String,
            required: true,
            container: null,
          },
        ],
        schemaFieldRoles: {
          __typename: 'ContentSchemaFieldRoles',
          displayName: null,
          parentId: null,
          threadId: null,
          createdAt: null,
          creatorId: null,
        },
      },
    },
  };
}

const mocks: MockedResponse[] = [
  {
    request: {
      query: GQLGetLatestUserSubmittedItemsDocument,
      variables: { itemIdentifier: userIdentifier },
    },
    result: {
      data: {
        __typename: 'Query',
        latestItemsCreatedBy: [
          makeSubmission('content-1', 'First history value'),
          makeSubmission('content-2', 'Second history value'),
        ],
      },
    },
  },
];

test('renders non-thread history items without fetching each item again', async () => {
  const operationNames: string[] = [];
  const link = ApolloLink.from([
    new ApolloLink((operation, forward) => {
      operationNames.push(operation.operationName);
      return forward(operation);
    }),
    new MockLink(mocks),
  ]);

  render(
    <MockedProvider link={link} cache={cache}>
      <ManualReviewJobLatestSubmissionsWithThreadComponent
        userIdentifier={userIdentifier}
        unblurAllMedia={false}
        allItemTypes={[]}
        allActions={[]}
        allPolicies={[]}
        relatedActions={[]}
        onEnqueueActions={vi.fn()}
        setRelatedUser={vi.fn()}
        requirePolicySelectionToEnqueueAction={false}
        allowMoreThanOnePolicySelection={false}
      />
    </MockedProvider>,
  );

  expect(await screen.findByText('First history value')).toBeInTheDocument();
  expect(await screen.findByText('Second history value')).toBeInTheDocument();
  expect(operationNames).not.toContain('getRelatedItems');
});
