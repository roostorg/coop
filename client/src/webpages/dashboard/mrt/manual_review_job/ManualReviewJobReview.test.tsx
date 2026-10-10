import type {
  GQLDequeueManualReviewJobMutation,
  GQLManualReviewJobInfoQuery,
  GQLSubmitManualReviewDecisionMutation,
} from '@/graphql/generated';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ManualReviewJobReview from './ManualReviewJobReview';

type DequeueResponse = GQLDequeueManualReviewJobMutation;
type SubmitResponse = GQLSubmitManualReviewDecisionMutation;

type Harness = {
  route: {
    queueId: string;
    jobId: string | undefined;
    lockToken: string | undefined;
  };
  navigate: ReturnType<typeof vi.fn>;
  dequeue: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
  queryData: GQLManualReviewJobInfoQuery;
  dequeueData: DequeueResponse | undefined;
  nextResult: DequeueResponse;
  onDequeue: ((data: DequeueResponse) => void) | undefined;
  onSubmit: ((data: SubmitResponse) => Promise<void>) | undefined;
};

const harness = vi.hoisted<Harness>(() => ({
  route: { queueId: 'queue-1', jobId: 'a', lockToken: 'reviewer-1' },
  navigate: vi.fn(),
  dequeue: vi.fn(),
  submit: vi.fn(),
  queryData: undefined as unknown as GQLManualReviewJobInfoQuery,
  dequeueData: undefined,
  nextResult: { __typename: 'Mutation', dequeueManualReviewJob: null },
  onDequeue: undefined,
  onSubmit: undefined,
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useParams: () => harness.route,
  useNavigate: () => harness.navigate,
}));

// Keep the production screen and its mutation callbacks, but isolate rendering
// from the backing services and unrelated content widgets.
vi.mock('@/graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/graphql/generated')>()),
  useGQLManualReviewJobInfoQuery: () => ({
    loading: false,
    data: harness.queryData,
    refetch: vi.fn(),
  }),
  useGQLDequeueManualReviewJobMutation(options: {
    onCompleted: NonNullable<Harness['onDequeue']>;
  }) {
    harness.onDequeue = options.onCompleted;
    return [harness.dequeue, { data: harness.dequeueData, loading: false }];
  },
  useGQLSubmitManualReviewDecisionMutation(options: {
    onCompleted: NonNullable<Harness['onSubmit']>;
  }) {
    harness.onSubmit = options.onCompleted;
    return [harness.submit, { loading: false }];
  },
  useGQLLogSkipMutation: () => [vi.fn()],
  useGQLReleaseJobLockMutation: () => [vi.fn()],
}));

vi.mock('./v2/useEnqueueActionGate', () => ({
  useEnqueueActionGate: () => ({}),
}));
vi.mock('./v2/ncmec/NCMECReviewUser', () => ({
  default: () => <div>Active review</div>,
}));
vi.mock('./v2/ManualReviewJobContentView', () => ({
  default: () => <div>Content review</div>,
}));
vi.mock('./ReportInfoComponent', () => ({ default: () => null }));
vi.mock('../../components/PolicyDropdown', () => ({ default: () => null }));
vi.mock('./v2/related_actions/ManualReviewJobEnqueuedRelatedActions', () => ({
  default: () => null,
}));
vi.mock('../../components/CoopModal', () => ({
  default: function MockModal({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer: { title: string; onClick: () => void }[];
  }) {
    return visible ? (
      <div>
        {children}
        {footer.map((button) => (
          <button key={button.title} onClick={button.onClick}>
            {button.title}
          </button>
        ))}
      </div>
    ) : null;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  harness.route = { queueId: 'queue-1', jobId: 'a', lockToken: 'reviewer-1' };
  harness.dequeueData = undefined;
  harness.queryData = makeNcmecQueryData();
  harness.nextResult = { __typename: 'Mutation', dequeueManualReviewJob: null };
  harness.onDequeue = undefined;
  harness.onSubmit = undefined;
  harness.dequeue.mockImplementation(async () => {
    harness.dequeueData = harness.nextResult;
    harness.onDequeue!(harness.nextResult);
    return { data: harness.nextResult };
  });
});
afterEach(cleanup);

const submitted = {
  __typename: 'Mutation',
  submitManualReviewDecision: {
    __typename: 'SubmitDecisionSuccessResponse',
    success: true,
    warnings: [],
  },
} satisfies SubmitResponse;

function makeNcmecQueryData() {
  return {
    myOrg: { id: 'org-1', actions: [], policies: [] },
    me: {
      id: 'reviewer-1',
      permissions: [],
      reviewableQueues: [
        {
          id: 'queue-1',
          pendingJobCount: 1,
          jobs: [
            {
              id: 'a',
              policyIds: [],
              payload: { __typename: 'NcmecManualReviewJobPayload' },
            },
          ],
        },
      ],
    },
  } as unknown as GQLManualReviewJobInfoQuery;
}

function makeContentQueryData(opts: { hasCreator: boolean }) {
  const creatorField = {
    name: 'creator',
    type: 'RELATED_ITEM',
    required: false,
    container: null,
  };
  const contentType = {
    __typename: 'ContentItemType',
    id: 'content-type',
    name: 'Post',
    description: null,
    version: '1',
    schemaVariant: 'original',
    baseFields: opts.hasCreator ? [creatorField] : [],
    schemaFieldRoles: opts.hasCreator ? { creatorId: 'creator' } : {},
  };
  const item = {
    __typename: 'ContentItem',
    id: 'content-1',
    submissionId: 'submission-1',
    submissionTime: '2026-09-30T00:00:00.000Z',
    type: contentType,
    data: opts.hasCreator
      ? { creator: { id: 'user-1', typeId: 'user-type' } }
      : {},
  };
  return {
    myOrg: {
      id: 'org-1',
      actions: [],
      policies: [],
      itemTypes: [contentType],
      mrtQueues: [],
      hasNCMECReportingEnabled: true,
      requiresPolicyForDecisionsInMrt: false,
      requiresDecisionReasonInMrt: false,
      requiresDecisionReasonOnIgnoreInMrt: false,
      allowMultiplePoliciesPerAction: false,
      hideSkipButtonForNonAdmins: false,
    },
    me: {
      id: 'reviewer-1',
      permissions: [],
      reviewableQueues: [
        {
          id: 'queue-1',
          name: 'Review queue',
          hiddenActionIds: [],
          pendingJobCount: 1,
          jobs: [
            {
              id: 'a',
              createdAt: '2026-09-30T00:00:00.000Z',
              policyIds: [],
              numTimesReported: 1,
              payload: {
                __typename: 'ContentManualReviewJobPayload',
                reportHistory: [],
                item,
                additionalContentItems: [],
                itemThreadContentItems: [],
                reportedForReasons: [],
                enqueueSourceInfo: {
                  __typename: 'ReportEnqueueSourceInfo',
                  kind: 'REPORT',
                },
              },
            },
          ],
        },
      ],
    },
  } as unknown as GQLManualReviewJobInfoQuery;
}

describe('review advancement after a decision', () => {
  it('leaves the last completed review rather than rendering the old query again', async () => {
    const { rerender } = render(<ManualReviewJobReview />);
    expect(screen.getByText('Active review')).toBeTruthy();

    await act(async () => {
      await harness.onSubmit!(submitted);
    });
    rerender(<ManualReviewJobReview />);

    expect(harness.dequeue).toHaveBeenCalledTimes(1);
    expect(harness.navigate).toHaveBeenCalledWith(
      '/dashboard/manual_review/queues',
      { replace: true },
    );
    expect(screen.queryByText('Active review')).toBeNull();
    expect(screen.getByText('No Jobs to Review')).toBeTruthy();
  });

  it('returns to queues when the already-submitted recovery finds no next job', async () => {
    const { rerender } = render(<ManualReviewJobReview />);
    await act(async () => {
      await harness.onSubmit!({
        __typename: 'Mutation',
        submitManualReviewDecision: {
          __typename: 'JobHasAlreadyBeenSubmittedError',
          title: 'Already submitted',
          status: 409,
          type: ['JobHasAlreadyBeenSubmittedError'],
        },
      });
    });
    expect(harness.dequeue).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });
    rerender(<ManualReviewJobReview />);

    expect(harness.dequeue).toHaveBeenCalledTimes(1);
    expect(harness.navigate).toHaveBeenCalledWith(
      '/dashboard/manual_review/queues',
      { replace: true },
    );
    expect(screen.queryByText('Active review')).toBeNull();
  });

  it('navigates to the returned job and its new lock after a successful decision', async () => {
    // Navigation only requires the response identity; the selector tests cover
    // rendering the full next job while its refreshed query is in flight.
    harness.nextResult = {
      __typename: 'Mutation',
      dequeueManualReviewJob: {
        __typename: 'DequeueManualReviewJobSuccessResponse',
        lockToken: 'next-lock',
        numPendingJobs: 0,
        job: { id: 'b' },
      },
    } as DequeueResponse;
    render(<ManualReviewJobReview />);
    await act(async () => {
      await harness.onSubmit!(submitted);
    });

    expect(harness.navigate).toHaveBeenCalledWith(
      '/dashboard/manual_review/queues/review/queue-1/b/next-lock',
      { replace: true },
    );
    expect(harness.navigate).not.toHaveBeenCalledWith(
      '/dashboard/manual_review/queues',
      expect.anything(),
    );
  });

  it('keeps the initial empty-queue view instead of navigating to a completed job', async () => {
    harness.route = {
      queueId: 'queue-1',
      jobId: undefined,
      lockToken: 'reviewer-1',
    };
    const { rerender } = render(<ManualReviewJobReview />);
    await act(async () => {
      await Promise.resolve();
    });
    rerender(<ManualReviewJobReview />);

    expect(harness.dequeue).toHaveBeenCalledTimes(1);
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(screen.getByText('No Jobs to Review')).toBeTruthy();
  });
});

describe('NCMEC escalation eligibility', () => {
  it('shows a server eligibility error without advancing the review', async () => {
    render(<ManualReviewJobReview />);

    await act(async () => {
      await harness.onSubmit!({
        __typename: 'Mutation',
        submitManualReviewDecision: {
          __typename: 'NcmecEscalationUnavailableError',
          title: 'This item cannot be enqueued to NCMEC.',
          status: 400,
          type: ['/errors/invalid-user-input'],
          detail: 'Content items must have a creator.',
        },
      });
    });

    expect(screen.getByText('Content items must have a creator.')).toBeTruthy();
    expect(harness.dequeue).not.toHaveBeenCalled();
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it('disables NCMEC escalation when a Content item has no creator', async () => {
    harness.queryData = makeContentQueryData({ hasCreator: false });
    render(<ManualReviewJobReview />);

    const actionLabel = screen.getByText('Enqueue to NCMEC');
    fireEvent.mouseOver(actionLabel);
    expect(
      await screen.findByText(
        'This content item has no creator. NCMEC review jobs must be linked to a user.',
      ),
    ).toBeTruthy();

    fireEvent.click(actionLabel);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(harness.submit).not.toHaveBeenCalled();
  });

  it('allows NCMEC escalation when a Content item has a creator', () => {
    harness.queryData = makeContentQueryData({ hasCreator: true });
    render(<ManualReviewJobReview />);

    fireEvent.click(screen.getByText('Enqueue to NCMEC'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(harness.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            reportedItemDecisionComponents: [
              {
                transformJobAndRecreateInQueue: {
                  newJobKind: 'NCMEC',
                  policyIds: [],
                },
              },
            ],
          }),
        }),
      }),
    );
  });
});
