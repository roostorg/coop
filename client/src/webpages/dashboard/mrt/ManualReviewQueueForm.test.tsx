import { TooltipProvider } from '@/coop-ui/Tooltip';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLManualReviewQueueDocument,
  GQLQueueFormDataDocument,
  GQLUpdateManualReviewQueueDocument,
  type GQLUpdateManualReviewQueueMutationVariables,
} from '@/graphql/generated';

import ManualReviewQueueForm from './ManualReviewQueueForm';

const QUEUE_ID = 'queue-1';

function queueFormDataMock(hasAppealsEnabled: boolean): MockedResponse {
  return {
    request: { query: GQLQueueFormDataDocument },
    maxUsageCount: Infinity,
    result: {
      data: {
        myOrg: {
          __typename: 'Org',
          hasAppealsEnabled,
          hasPartialItemsEndpoint: false,
          users: [],
          actions: [],
          usersWhoCanReviewEveryQueue: [],
        },
      },
    },
  };
}

function manualReviewQueueMock(isAppealsQueue: boolean): MockedResponse {
  return {
    request: {
      query: GQLManualReviewQueueDocument,
      variables: { id: QUEUE_ID },
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        manualReviewQueue: {
          __typename: 'ManualReviewQueue',
          id: QUEUE_ID,
          name: 'Existing Queue',
          description: null,
          explicitlyAssignedReviewers: [],
          hiddenActionIds: [],
          isAppealsQueue,
          autoCloseJobs: false,
          clearReportsDisposition: null,
          clearReportsScope: 'CURRENT_QUEUE',
          clearReportsTriggerActionIds: [],
        },
      },
    },
  };
}

function renderEditForm(mocks: MockedResponse[]) {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <MockedProvider mocks={mocks}>
          <MemoryRouter
            initialEntries={[
              `/dashboard/manual_review/queues/form/${QUEUE_ID}`,
            ]}
          >
            <Routes>
              <Route
                path="/dashboard/manual_review/queues/form/:id"
                element={<ManualReviewQueueForm />}
              />
            </Routes>
          </MemoryRouter>
        </MockedProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );
}

const appealsCheckbox = () =>
  screen.queryByRole('checkbox', { name: /this is an appeals queue/i });

describe('ManualReviewQueueForm (edit)', () => {
  it('shows the appeals queue checkbox when appeals are enabled', async () => {
    renderEditForm([queueFormDataMock(true), manualReviewQueueMock(false)]);

    await screen.findByText('Update Manual Review Queue');
    await waitFor(() => expect(appealsCheckbox()).toBeInTheDocument());
    expect(appealsCheckbox()).not.toBeChecked();
    expect(
      screen.getByText(/can only be converted to or from an appeals queue/i),
    ).toBeInTheDocument();
  });

  it('reflects the queue being an appeals queue already', async () => {
    renderEditForm([queueFormDataMock(true), manualReviewQueueMock(true)]);

    await screen.findByText('Update Manual Review Queue');
    await waitFor(() => expect(appealsCheckbox()).toBeChecked());
  });

  it('hides the appeals queue checkbox when appeals are disabled', async () => {
    renderEditForm([queueFormDataMock(false), manualReviewQueueMock(false)]);

    await screen.findByText('Update Manual Review Queue');
    expect(appealsCheckbox()).not.toBeInTheDocument();
  });

  it('sends the new appeals flag when saving', async () => {
    let calledVariables:
      GQLUpdateManualReviewQueueMutationVariables | undefined;
    const updateMock: MockedResponse = {
      request: { query: GQLUpdateManualReviewQueueDocument },
      variableMatcher: (variables) => {
        calledVariables =
          variables as GQLUpdateManualReviewQueueMutationVariables;
        return true;
      },
      result: {
        data: {
          updateManualReviewQueue: {
            __typename: 'MutateManualReviewQueueSuccessResponse',
            data: {
              __typename: 'ManualReviewQueue',
              id: QUEUE_ID,
              name: 'Existing Queue',
              description: null,
            },
          },
        },
      },
    };
    renderEditForm([
      queueFormDataMock(true),
      manualReviewQueueMock(false),
      updateMock,
    ]);

    await screen.findByText('Update Manual Review Queue');
    await waitFor(() => expect(appealsCheckbox()).toBeInTheDocument());
    fireEvent.click(appealsCheckbox()!);
    await waitFor(() => expect(appealsCheckbox()).toBeChecked());
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(calledVariables).toBeDefined());
    expect(calledVariables?.input).toMatchObject({
      id: QUEUE_ID,
      isAppealsQueue: true,
    });
    expect(await screen.findByText('Changes Saved')).toBeInTheDocument();
  });

  it('surfaces the server explanation when the queue cannot be converted', async () => {
    const title =
      'This queue cannot be converted while it still has pending jobs. Empty the queue first.';
    const updateMock: MockedResponse = {
      request: { query: GQLUpdateManualReviewQueueDocument },
      variableMatcher: () => true,
      result: {
        data: {
          updateManualReviewQueue: {
            __typename: 'UnableToChangeQueueTypeError',
            title,
            status: 409,
            type: ['/errors/conflict'],
          },
        },
      },
    };
    renderEditForm([
      queueFormDataMock(true),
      manualReviewQueueMock(false),
      updateMock,
    ]);

    await screen.findByText('Update Manual Review Queue');
    await waitFor(() => expect(appealsCheckbox()).toBeInTheDocument());
    fireEvent.click(appealsCheckbox()!);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
