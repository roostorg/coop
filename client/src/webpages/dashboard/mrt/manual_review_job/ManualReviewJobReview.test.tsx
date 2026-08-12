import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';

import ManualReviewJobReview from './ManualReviewJobReview';

const selectProps = vi.hoisted(() => vi.fn());
const optionProps = vi.hoisted(() => vi.fn());

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  const Button = ({ children }: { children?: ReactNode }) => (
    <button>{children}</button>
  );
  const Input = { ...actual.Input, TextArea: () => <textarea /> };
  const Select = ({ children, ...props }: { children?: ReactNode }) => {
    selectProps(props);
    return <>{children}</>;
  };
  Select.Option = ({ children, ...props }: { children?: ReactNode }) => {
    optionProps(props);
    return <>{children}</>;
  };

  return { ...actual, Button, Input, Select };
});

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
  useParams: () => ({ queueId: 'queue-1', jobId: 'job-1', lockToken: 'lock' }),
}));

vi.mock('../../../../graphql/generated', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../graphql/generated')>();
  const mutation = () => [vi.fn(), { loading: false }];

  return {
    ...actual,
    useGQLManualReviewJobInfoQuery: () => ({
      loading: false,
      refetch: vi.fn(),
      data: {
        myOrg: {
          id: 'org-1',
          policies: [],
          itemTypes: [],
          actions: [],
          requiresPolicyForDecisionsInMrt: false,
          requiresDecisionReasonInMrt: false,
          requiresDecisionReasonOnIgnoreInMrt: false,
          allowMultiplePoliciesPerAction: false,
          hideSkipButtonForNonAdmins: false,
        },
        me: {
          permissions: [],
          reviewableQueues: [
            {
              id: 'queue-1',
              name: 'User review',
              hiddenActionIds: [],
              pendingJobCount: 1,
              jobs: [
                {
                  id: 'job-1',
                  createdAt: '2026-01-01T00:00:00.000Z',
                  policyIds: [],
                  payload: {
                    __typename: 'UserManualReviewJobPayload',
                    item: {
                      id: 'user-1',
                      type: { id: 'user', name: 'User' },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    }),
    useGQLDequeueManualReviewJobMutation: () => [vi.fn(), { loading: false }],
    useGQLLogSkipMutation: mutation,
    useGQLReleaseJobLockMutation: mutation,
    useGQLSubmitManualReviewDecisionMutation: mutation,
  };
});

vi.mock('./v2/user/ManualReviewJobPrimaryUserComponent', () => ({
  default: () => null,
}));
vi.mock('../../components/PolicyDropdown', () => ({
  default: () => null,
}));
vi.mock('./ReportInfoComponent', () => ({ default: () => null }));
vi.mock('./MergedReportsComponent', () => ({ default: () => null }));

test('configures the Options label and preserves the media blur toggle', () => {
  render(
    <HelmetProvider>
      <ManualReviewJobReview />
    </HelmetProvider>,
  );

  expect(selectProps).toHaveBeenCalledWith(
    expect.objectContaining({
      optionLabelProp: 'label',
      value: 'Options',
    }),
  );
  expect(optionProps).toHaveBeenCalledWith(
    expect.objectContaining({
      label: 'Options',
      value: 'Options',
    }),
  );

  fireEvent.click(screen.getByText('Unblur All Media'));
  expect(screen.getByText('Blur All Media')).toBeTruthy();
});
