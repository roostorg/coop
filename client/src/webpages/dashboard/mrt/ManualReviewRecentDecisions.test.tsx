import { MockedProvider } from '@apollo/client/testing';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLDequeueManualReviewJobDocument,
  GQLGetDecidedJobDocument,
  GQLGetRecentModerationActivityDocument,
  GQLManualActionItemsDocument,
  GQLManualReviewDecisionInsightsFilterByInfoDocument,
  GQLManualReviewJobInfoDocument,
  GQLOrgLookupDataDocument,
  GQLRecentDecisionsSummaryDataDocument,
  GQLUserPermission,
  type GQLRecentModerationActivityInput,
} from '@/graphql/generated';

import ManualReviewRecentDecisions from './ManualReviewRecentDecisions';

// jsdom implements neither the Pointer Events capture API nor
// `scrollIntoView`. The `Show` control (`@/coop-ui/Select`, a Radix select)
// opens on a native `pointerdown` and calls `hasPointerCapture` from that
// handler, so without these stubs simply clicking it throws.
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture ||= () => false;
  window.HTMLElement.prototype.releasePointerCapture ||= () => {};
  window.HTMLElement.prototype.setPointerCapture ||= () => {};
  window.HTMLElement.prototype.scrollIntoView ||= () => {};
});

// Mirrors exactly what `ManualReviewRecentDecisions` sends on mount: no
// filters saved, no search string, no cursor. If the component's initial
// query variables ever drift from this, MockedProvider will report "no
// matching mock" rather than a useful diff, so keep this in lockstep with
// `buildActivityInput({}, undefined)`.
const initialActivityInput: GQLRecentModerationActivityInput = {
  cursor: undefined,
  view: 'ALL',
  userSearchString: undefined,
  policyIds: undefined,
  reviewerIds: undefined,
  queueIds: undefined,
  startTime: undefined,
  endTime: undefined,
  decisions: undefined,
};

const orgLookupMock = {
  request: {
    query: GQLOrgLookupDataDocument,
  },
  result: {
    data: {
      __typename: 'Query',
      // Manual actions require VIEW_INVESTIGATION. Every role but
      // EXTERNAL_MODERATOR holds it, so this is the ordinary reviewer.
      me: {
        __typename: 'User',
        id: 'user-1',
        permissions: [
          GQLUserPermission.ViewMrt,
          GQLUserPermission.ViewInvestigation,
        ],
      },
      myOrg: {
        __typename: 'Org',
        id: 'org-1',
        actions: [],
        policies: [],
        users: [],
        mrtQueues: [],
      },
    },
  },
};

// Once the table mounts, it renders `ManualReviewRecentDecisionsFilter` as
// its `topRightComponent`, which fires this query itself on mount — it isn't
// visible from reading only ManualReviewRecentDecisions.tsx.
const filterByInfoMock = {
  request: {
    query: GQLManualReviewDecisionInsightsFilterByInfoDocument,
  },
  result: {
    data: {
      __typename: 'Query',
      myOrg: {
        __typename: 'Org',
        actions: [],
        itemTypes: [],
        users: [],
        policies: [],
        mrtQueues: [
          { __typename: 'ManualReviewQueue', id: 'q-appeals', name: 'Appeals' },
        ],
        rules: [],
      },
    },
  },
};

function activityMocks(rows: readonly unknown[]) {
  return [
    orgLookupMock,
    filterByInfoMock,
    {
      request: {
        query: GQLGetRecentModerationActivityDocument,
        variables: { input: initialActivityInput },
      },
      result: {
        data: {
          __typename: 'Query',
          recentModerationActivity: {
            __typename: 'ModerationActivityPage',
            nextCursor: null,
            rows,
          },
        },
      },
    },
  ];
}

// `__typename` is included explicitly on every mocked object below (the
// interface requires it for fragment matching), so `MockedProvider` doesn't
// need `addTypename` — Apollo Client 3.14 rejects that prop outright.
const renderPage = (mocks: readonly unknown[]) =>
  render(
    <HelmetProvider>
      <MockedProvider mocks={mocks as never}>
        <MemoryRouter>
          <ManualReviewRecentDecisions />
        </MemoryRouter>
      </MockedProvider>
    </HelmetProvider>,
  );

const reviewJobRow = {
  __typename: 'ReviewJobDecisionRow',
  id: 'd-9',
  ts: '2026-08-05T13:58:00.000Z',
  reviewerId: 'u-1',
  jobId: 'job-1',
  queueId: 'q-1',
  itemId: 'i-1',
  itemTypeId: 't-1',
  decisions: [],
  decisionReason: null,
};

const manualActionRow = (overrides: {
  itemCount: number;
  failedCount: number;
}) => ({
  __typename: 'ManualActionRow',
  id: 'manual-action-run:abc',
  ts: '2026-08-05T13:51:00.000Z',
  reviewerId: 'u-2',
  correlationId: 'manual-action-run:abc',
  itemTypeId: 't-1',
  actionIds: ['act-1'],
  policyIds: [],
  actorNote: null,
  ...overrides,
});

// Builds an activity mock whose variables are `initialActivityInput` with the
// given overrides applied — keeps each `Show`-control test's mock focused on
// just the fields it cares about instead of restating the whole input shape.
function activityMockFor(
  variablesOverride: Partial<GQLRecentModerationActivityInput>,
  rows: readonly unknown[],
) {
  return {
    request: {
      query: GQLGetRecentModerationActivityDocument,
      variables: { input: { ...initialActivityInput, ...variablesOverride } },
    },
    result: {
      data: {
        __typename: 'Query',
        recentModerationActivity: {
          __typename: 'ModerationActivityPage',
          nextCursor: null,
          rows,
        },
      },
    },
  };
}

// Like `activityMockFor`, but lets a test set `nextCursor` so cursor paging
// can be driven end to end. `cursorIn` is what the client should send for
// that page — `undefined` on page 1.
function activityPageMock(
  cursorIn: string | undefined,
  rows: readonly unknown[],
  nextCursor: string | null,
) {
  return {
    request: {
      query: GQLGetRecentModerationActivityDocument,
      variables: { input: { ...initialActivityInput, cursor: cursorIn } },
    },
    result: {
      data: {
        __typename: 'Query',
        recentModerationActivity: {
          __typename: 'ModerationActivityPage',
          nextCursor,
          rows,
        },
      },
    },
  };
}

const decisionRowWith = (id: string, reason: string) => ({
  ...reviewJobRow,
  id,
  decisionReason: reason,
});

// Drives the existing filter UI (not something Task 13 owns) through
// opening it, expanding Queues, picking the one seeded queue ("Appeals"),
// and saving — the same path a moderator would use.
async function applyQueueFilter(container: HTMLElement) {
  fireEvent.click(await screen.findByText('Select any'));
  fireEvent.click(await screen.findByText('Queues'));
  const queueSelector = container.querySelector('.ant-select-selector');
  expect(queueSelector).not.toBeNull();
  fireEvent.mouseDown(queueSelector as Element);
  fireEvent.click(await screen.findByText('Appeals'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

// Drives the `Show` control (a Radix `Select`, not a native <select>): open
// it via its trigger (labelled "Show"), then click the option with the given
// visible label.
async function chooseFeedView(label: 'All' | 'Decisions' | 'Actions') {
  userEvent.click(await screen.findByLabelText('Show'));
  userEvent.click(await screen.findByRole('option', { name: label }));
}

// Builds a mock for the per-run item list `ManualActionItemsPanel` fetches
// on expand. `totalCount` defaults to `items.length`; pass it explicitly to
// simulate a run whose item count exceeds what a single page returns.
function manualActionItemsMock(
  correlationId: string,
  occurredAt: string,
  items: readonly {
    itemId: string;
    itemTypeId: string | null;
    failed: boolean;
  }[],
  totalCount: number = items.length,
) {
  return {
    request: {
      query: GQLManualActionItemsDocument,
      variables: { input: { correlationId, occurredAt, limit: 1000 } },
    },
    result: {
      data: {
        __typename: 'Query',
        manualActionItems: {
          __typename: 'ManualActionItemsPage',
          totalCount,
          items: items.map((item) => ({
            __typename: 'ManualActionItem',
            ...item,
          })),
        },
      },
    },
  };
}

// Selecting a decision (`reviewJobRow` below, id `d-9`) always fires
// `getDecidedJob({ id: selection.decision.id })` and always mounts
// `ManualReviewRecentDecisionSummary` (which fires its own
// `RecentDecisionsSummaryData` query independent of `getDecidedJob`). The
// parent throws whatever error `getDecidedJob` produces, so any test that
// selects a decision needs this mocked with a *non-error* result or the
// render blows up — the actual job body isn't relevant to selection tests,
// so `getDecidedJob: null` (a real, if empty, state `ManualReviewJobReview`
// already handles by staying in its loading view) is enough.
const decidedJobMock = {
  request: {
    query: GQLGetDecidedJobDocument,
    variables: { id: 'd-9' },
  },
  result: {
    data: {
      __typename: 'Query',
      getDecidedJob: null,
    },
  },
};

const recentDecisionsSummaryDataMock = {
  request: {
    query: GQLRecentDecisionsSummaryDataDocument,
  },
  result: {
    data: {
      __typename: 'Query',
      myOrg: {
        __typename: 'Org',
        users: [],
        mrtQueues: [],
        actions: [],
        policies: [],
        itemTypes: [],
      },
    },
  },
};

// `ManualReviewJobReview` (mounted once `getDecidedJob` resolves, even to
// `null` — see `decidedJobMock` above) unconditionally fires this query on
// mount, and — because there's no `closedJob` and no route-param `lockToken`
// in this embedded context — stays permanently in its own loading state
// rather than reaching the job body. Left unmocked, the missing response
// surfaces as an unhandled rejection (not a rendering throw, since it's
// caught inside that component's own query state), which is still worth
// avoiding.
const manualReviewJobInfoMock = {
  request: {
    query: GQLManualReviewJobInfoDocument,
    variables: { jobIds: [] },
  },
  result: {
    data: {
      __typename: 'Query',
      myOrg: {
        __typename: 'Org',
        id: 'org-1',
        hasNCMECReportingEnabled: false,
        requiresPolicyForDecisionsInMrt: false,
        requiresDecisionReasonInMrt: false,
        requiresDecisionReasonOnIgnoreInMrt: false,
        allowMultiplePoliciesPerAction: false,
        hideSkipButtonForNonAdmins: false,
        policies: [],
        itemTypes: [],
        actions: [],
        mrtQueues: [],
      },
      me: {
        __typename: 'User',
        id: 'u-1',
        permissions: [],
        reviewableQueues: [],
      },
    },
  },
};

// With no `closedJob` and no route-param `jobId`, `ManualReviewJobReview`
// treats itself as "on the live queue" and auto-fires this mutation to fetch
// a job to review. That's the live-queue-review behavior, irrelevant here,
// but it fires regardless — mock it to a no-op result so it doesn't dangle
// as an unhandled rejection.
const dequeueManualReviewJobMock = {
  request: {
    query: GQLDequeueManualReviewJobDocument,
    variables: { queueId: undefined },
  },
  result: {
    data: {
      __typename: 'Mutation',
      dequeueManualReviewJob: null,
    },
  },
};

describe('ManualReviewRecentDecisions', () => {
  beforeEach(() => {
    // The `Show` control persists its choice to real (jsdom) localStorage,
    // which otherwise leaks between tests in this file.
    localStorage.clear();
  });

  it('labels a review job row and a manual action row differently', async () => {
    renderPage(
      activityMocks([
        reviewJobRow,
        manualActionRow({ itemCount: 84, failedCount: 0 }),
      ]),
    );

    expect(await screen.findByText('Review Job')).toBeInTheDocument();
    expect(await screen.findByText('Manual Action')).toBeInTheDocument();
  });

  // Regression guard: an earlier task removed offset paging and, with it,
  // both CSV export buttons (they read the `page` state the activity feed
  // no longer uses). Both must stay present regardless of how the table
  // itself is paged.
  it('shows both the Download and Download Skips buttons', async () => {
    renderPage(activityMocks([]));

    expect(
      await screen.findByRole('button', { name: 'Download' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Download Skips' }),
    ).toBeInTheDocument();
  });

  it('shows the item count on a bulk run', async () => {
    renderPage(
      activityMocks([manualActionRow({ itemCount: 84, failedCount: 0 })]),
    );

    expect(await screen.findByText('84 items')).toBeInTheDocument();
  });

  it('reports how many items an action failed on', async () => {
    renderPage(
      activityMocks([manualActionRow({ itemCount: 84, failedCount: 3 })]),
    );

    expect(await screen.findByText('3 of 84 failed')).toBeInTheDocument();
  });

  describe('Show control', () => {
    it('sends view: ACTIONS when Actions is selected', async () => {
      renderPage([
        ...activityMocks([]),
        activityMockFor({ view: 'ACTIONS' }, [
          manualActionRow({ itemCount: 7, failedCount: 0 }),
        ]),
      ]);

      await chooseFeedView('Actions');

      // Only the ACTIONS-view mock resolves to a row with "7 items", so this
      // only passes if `view: 'ACTIONS'` was actually sent as a variable.
      expect(await screen.findByText('7 items')).toBeInTheDocument();
    });

    it('moves Show to Decisions and explains why when a queue filter is applied', async () => {
      const { container } = renderPage([
        ...activityMocks([]),
        activityMockFor({ view: 'DECISIONS', queueIds: ['q-appeals'] }, []),
      ]);

      await applyQueueFilter(container);

      expect(await screen.findByLabelText('Show')).toHaveTextContent(
        'Decisions',
      );
      expect(await screen.findByLabelText('Show')).toBeDisabled();
      expect(
        await screen.findByText(/manual actions have no queue/i),
      ).toBeInTheDocument();
    });

    it("restores the user's previously chosen view when the queue filter is cleared", async () => {
      const { container } = renderPage([
        ...activityMocks([]),
        activityMockFor({ view: 'DECISIONS', queueIds: ['q-appeals'] }, []),
        // Clearing the filter re-issues the original (no-filter, ALL-view)
        // request, so the initial mount mock is needed a second time.
        ...activityMocks([]),
      ]);

      await applyQueueFilter(container);
      expect(await screen.findByLabelText('Show')).toHaveTextContent(
        'Decisions',
      );

      const filterBadge = await screen.findByText('1 Filter');
      const clearIcon = filterBadge.querySelector('svg');
      expect(clearIcon).not.toBeNull();
      fireEvent.click(clearIcon as Element);

      expect(await screen.findByLabelText('Show')).toHaveTextContent('All');
      expect(await screen.findByLabelText('Show')).not.toBeDisabled();
    });

    it('shows the child-safety disclosure unless the view is Decisions', async () => {
      renderPage([
        ...activityMocks([]),
        activityMockFor({ view: 'DECISIONS' }, []),
      ]);

      expect(
        await screen.findByText(
          /manual actions are not filtered by child-safety permissions/i,
        ),
      ).toBeInTheDocument();

      await chooseFeedView('Decisions');

      await waitFor(() => {
        expect(
          screen.queryByText(
            /manual actions are not filtered by child-safety permissions/i,
          ),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Manual action side panel', () => {
    it('loads and lists the items, and narrows the table, when a bulk row is selected', async () => {
      renderPage([
        ...activityMocks([manualActionRow({ itemCount: 2, failedCount: 1 })]),
        manualActionItemsMock(
          'manual-action-run:abc',
          '2026-08-05T13:51:00.000Z',
          [
            { itemId: 'usr_8813', itemTypeId: 't-1', failed: false },
            { itemId: 'usr_8815', itemTypeId: 't-1', failed: true },
          ],
        ),
      ]);

      // The "Columns" control only shows when nothing is selected (it's part
      // of `tableControls`, which the table hides in favor of the detail
      // side panel) — asserting it's there first, then gone, is proof the
      // panel opened in the side panel rather than in-cell beneath the row.
      expect(
        await screen.findByRole('button', { name: 'Columns' }),
      ).toBeInTheDocument();

      userEvent.click(await screen.findByRole('button', { name: /2 items/i }));

      expect(await screen.findByText('usr_8813')).toBeInTheDocument();
      expect(await screen.findByText('usr_8815')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Columns' }),
      ).not.toBeInTheDocument();
    });

    it('opens the panel when the row itself is clicked, not just the item-count control', async () => {
      renderPage([
        ...activityMocks([manualActionRow({ itemCount: 2, failedCount: 0 })]),
        manualActionItemsMock(
          'manual-action-run:abc',
          '2026-08-05T13:51:00.000Z',
          [{ itemId: 'usr_8813', itemTypeId: 't-1', failed: false }],
        ),
      ]);

      // "Manual Action" is the row's origin badge, not the "2 items"
      // control — clicking it should select the row the same way clicking
      // anywhere on a decision row does.
      userEvent.click(await screen.findByText('Manual Action'));

      expect(await screen.findByText('usr_8813')).toBeInTheDocument();
    });

    it('marks a failed item distinctly from a successful one', async () => {
      renderPage([
        ...activityMocks([manualActionRow({ itemCount: 2, failedCount: 1 })]),
        manualActionItemsMock(
          'manual-action-run:abc',
          '2026-08-05T13:51:00.000Z',
          [
            { itemId: 'usr_8813', itemTypeId: 't-1', failed: false },
            { itemId: 'usr_8815', itemTypeId: 't-1', failed: true },
          ],
        ),
      ]);

      userEvent.click(await screen.findByRole('button', { name: /2 items/i }));

      const failedRow = (await screen.findByText('usr_8815')).closest('li');
      expect(failedRow).not.toBeNull();
      expect(
        within(failedRow as HTMLElement).getByText(/failed/i),
      ).toBeInTheDocument();

      const okRow = (await screen.findByText('usr_8813')).closest('li');
      expect(okRow).not.toBeNull();
      expect(
        within(okRow as HTMLElement).queryByText(/failed/i),
      ).not.toBeInTheDocument();
    });

    it('states the truncation when the run has more items than the page returned', async () => {
      renderPage([
        ...activityMocks([manualActionRow({ itemCount: 84, failedCount: 0 })]),
        manualActionItemsMock(
          'manual-action-run:abc',
          '2026-08-05T13:51:00.000Z',
          [
            { itemId: 'usr_1', itemTypeId: 't-1', failed: false },
            { itemId: 'usr_2', itemTypeId: 't-1', failed: false },
          ],
          84,
        ),
      ]);

      userEvent.click(await screen.findByRole('button', { name: /84 items/i }));

      // Items come back ordered by id, so a truncated list is an arbitrary
      // slice and failures can fall outside it. The notice has to say so —
      // a reader who sees a clean list must not conclude nothing failed.
      expect(await screen.findByText(/84 items/)).toBeInTheDocument();
      expect(
        await screen.findByText(
          /showing first 2; some failures may not be listed/,
        ),
      ).toBeInTheDocument();
    });

    it('shows an error, not an empty list, when the item query fails', async () => {
      renderPage([
        ...activityMocks([manualActionRow({ itemCount: 2, failedCount: 0 })]),
        {
          request: {
            query: GQLManualActionItemsDocument,
            variables: {
              input: {
                correlationId: 'manual-action-run:abc',
                occurredAt: '2026-08-05T13:51:00.000Z',
                limit: 100,
              },
            },
          },
          error: new Error('boom'),
        },
      ]);

      userEvent.click(await screen.findByRole('button', { name: /2 items/i }));

      expect(
        await screen.findByText(/could not load the items/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no items recorded/i)).not.toBeInTheDocument();
    });

    it('clears the action panel when a decision row is selected, and vice versa', async () => {
      const { container } = renderPage([
        ...activityMocks([
          reviewJobRow,
          manualActionRow({ itemCount: 2, failedCount: 0 }),
        ]),
        manualActionItemsMock(
          'manual-action-run:abc',
          '2026-08-05T13:51:00.000Z',
          [{ itemId: 'usr_8813', itemTypeId: 't-1', failed: false }],
        ),
        decidedJobMock,
        recentDecisionsSummaryDataMock,
        manualReviewJobInfoMock,
        dequeueManualReviewJobMock,
      ]);

      userEvent.click(await screen.findByRole('button', { name: /2 items/i }));
      expect(await screen.findByText('usr_8813')).toBeInTheDocument();

      // Selecting is unified into one piece of state, so selecting the
      // decision row must replace the action selection outright rather than
      // leaving both panels (or the wrong one) rendered. Once a row is
      // selected the table collapses (`isCollapsed`), so the decision row's
      // per-column cells — including any dedicated click target — are gone;
      // the row itself is still the click target, same as before selection.
      const dataRows = container.querySelectorAll('tbody tr');
      expect(dataRows).toHaveLength(2);
      fireEvent.click(dataRows[0]); // reviewJobRow was passed in first

      expect(await screen.findByText('Decision Summary')).toBeInTheDocument();
      expect(screen.queryByText('usr_8813')).not.toBeInTheDocument();

      // ...and vice versa: reselecting the action row replaces the decision.
      fireEvent.click(dataRows[1]); // manualActionRow was passed in second

      expect(await screen.findByText('usr_8813')).toBeInTheDocument();
      expect(screen.queryByText('Decision Summary')).not.toBeInTheDocument();
    });
  });

  it('states the manual-action window, so an empty tail is not read as no activity', async () => {
    // Paging past the window returns no more actions and no has-more signal,
    // which is indistinguishable from "nobody bulk-actioned anything".
    // Decisions are unbounded, so the notice must not appear for them.
    renderPage(activityMocks([reviewJobRow]));

    expect(
      await screen.findByText(/Manual actions cover the last 30 days/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Set a start date to look further back/),
    ).toBeInTheDocument();
  });

  it('offers no Show control to a reviewer without VIEW_INVESTIGATION', async () => {
    // EXTERNAL_MODERATOR — read-only access for external moderation partners —
    // is the only role lacking it, and holds VIEW_MRT alone. The server refuses
    // manual actions for such a caller, so every option but Decisions would
    // return nothing; offer no control rather than two dead choices.
    const externalModeratorOrgMock = {
      request: { query: GQLOrgLookupDataDocument },
      result: {
        data: {
          ...(orgLookupMock.result.data as Record<string, unknown>),
          me: {
            __typename: 'User',
            id: 'user-1',
            permissions: [GQLUserPermission.ViewMrt],
          },
        },
      },
    };

    renderPage([
      externalModeratorOrgMock,
      ...activityMocks([reviewJobRow]).filter(
        (m) =>
          (m as { request: { query: unknown } }).request.query !==
          GQLOrgLookupDataDocument,
      ),
    ]);

    expect(await screen.findByText('Review Job')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/not filtered by child-safety permissions/i),
    ).not.toBeInTheDocument();
  });

  describe('cursor paging', () => {
    // The riskiest thing this page does: it replaced offset paging with a
    // server-issued cursor across two stores. A regression here silently drops
    // or repeats rows in an audit log, which is exactly what nobody notices.

    it('sends the cursor the server returned and advances the page label', async () => {
      renderPage([
        orgLookupMock,
        filterByInfoMock,
        activityPageMock(
          undefined,
          [decisionRowWith('d-1', 'page one')],
          'CURSOR_2',
        ),
        activityPageMock(
          'CURSOR_2',
          [decisionRowWith('d-2', 'page two')],
          null,
        ),
      ]);

      expect(await screen.findByText('page one')).toBeInTheDocument();
      expect(screen.getByText('Page 1')).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Next page'));

      expect(await screen.findByText('page two')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.queryByText('page one')).not.toBeInTheDocument();
    });

    it('returns to the first page with no cursor when Previous is used', async () => {
      renderPage([
        orgLookupMock,
        filterByInfoMock,
        activityPageMock(
          undefined,
          [decisionRowWith('d-1', 'page one')],
          'CURSOR_2',
        ),
        activityPageMock(
          'CURSOR_2',
          [decisionRowWith('d-2', 'page two')],
          null,
        ),
        // Page 1 is re-fetched on the way back — same variables as the initial
        // load, i.e. no cursor at all rather than an empty-string one.
        activityPageMock(
          undefined,
          [decisionRowWith('d-1', 'page one')],
          'CURSOR_2',
        ),
      ]);

      userEvent.click(await screen.findByLabelText('Next page'));
      expect(await screen.findByText('page two')).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Previous page'));

      expect(await screen.findByText('page one')).toBeInTheDocument();
      expect(screen.getByText('Page 1')).toBeInTheDocument();
    });

    it('disables Previous on the first page and Next at the end of the feed', async () => {
      renderPage([
        orgLookupMock,
        filterByInfoMock,
        activityPageMock(
          undefined,
          [decisionRowWith('d-1', 'only page')],
          null,
        ),
      ]);

      await screen.findByText('only page');

      // A click that silently does nothing is indistinguishable from one that
      // failed, so both ends must be visibly unavailable.
      expect(screen.getByLabelText('Previous page')).toBeDisabled();
      expect(screen.getByLabelText('Next page')).toBeDisabled();
    });

    // Not covered here: the double-click race that ran the page counter ahead
    // of the content. `handleNext` guards on `activityLoading` and the button
    // carries the same disabled state, but neither is observable under
    // jsdom — MockedProvider resolves the next page before a second click or
    // a `waitFor` can land, so any test written for it passes against the bug
    // too. Verified instead by driving a real browser.
  });
});
