import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import ManualReviewRecentDecisions from '@/webpages/dashboard/mrt/ManualReviewRecentDecisions';

const fakeDecision = {
  __typename: 'ManualReviewDecision',
  id: 'd1',
  jobId: 'j1',
  createdAt: '2026-08-23T00:00:00.000Z',
  assignedAt: null,
  jobCreatedAt: null,
  reviewerId: 'u1',
  queueId: 'q1',
  decisionReason: null,
  decisions: [
    {
      __typename: 'IgnoreDecisionComponent',
      type: 'IGNORE',
    },
  ],
};

let lazyCalls = 0;
let rejectDownload = false;
let finishDownload: (() => void) | undefined;
const downloadQuery = vi.fn(async () => {
  lazyCalls += 1;
  if (lazyCalls === 2) {
    if (rejectDownload) {
      throw new Error('download query failed');
    }
    await new Promise<void>((resolve) => {
      finishDownload = resolve;
    });
  }
  return { data: { getRecentDecisions: [] } };
});

vi.mock('../../../graphql/generated', async () => {
  const actual = await vi.importActual<
    typeof import('../../../graphql/generated')
  >('../../../graphql/generated');
  return {
    ...actual,
    useGQLOrgLookupDataQuery: () => ({
      data: {
        myOrg: {
          id: 'org1',
          actions: [],
          policies: [],
          users: [{ id: 'u1', firstName: 'Ada', lastName: 'Lovelace' }],
          mrtQueues: [{ id: 'q1', name: 'Queue 1' }],
        },
      },
    }),
    useGQLGetDecidedJobFromJobIdQuery: () => ({ data: undefined }),
    useGQLGetRecentDecisionsLazyQuery: () => [
      downloadQuery,
      {
        loading: false,
        error: undefined,
        data: { getRecentDecisions: [fakeDecision] },
      },
    ],
    useGQLGetSkipsForRecentDecisionsLazyQuery: () => [vi.fn()],
    useGQLGetDecidedJobLazyQuery: () => [
      vi.fn(),
      { loading: false, error: undefined, data: undefined },
    ],
  };
});

vi.mock('./ManualReviewRecentDecisionsFilter', () => ({
  default: function FilterStub() {
    return <div>filter</div>;
  },
}));

describe('Recent Decisions Download spinner', () => {
  beforeEach(() => {
    lazyCalls = 0;
    rejectDownload = false;
    finishDownload = undefined;
    downloadQuery.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads until the CSV download starts', async () => {
    const createObjectURL = vi.fn(() => 'blob:decisions');
    const revokeObjectURL = vi.fn();
    const clickDownload = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }),
    );

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ManualReviewRecentDecisions />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const download = await screen.findByRole('button', { name: 'Download' });
    fireEvent.click(download);

    await waitFor(() => {
      expect(download).toHaveClass('ant-btn-loading');
    });
    expect(finishDownload).toBeDefined();
    finishDownload?.();

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(clickDownload).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:decisions');
      expect(download).not.toHaveClass('ant-btn-loading');
    });
  });

  it('reports an error and stops loading when the query fails', async () => {
    rejectDownload = true;
    const errorMessage = vi.spyOn(message, 'error');

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ManualReviewRecentDecisions />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const download = await screen.findByRole('button', { name: 'Download' });
    fireEvent.click(download);

    await waitFor(() => {
      expect(errorMessage).toHaveBeenCalledWith(
        'Could not download recent decisions. Please try again.',
      );
      expect(download).not.toHaveClass('ant-btn-loading');
    });
  });
});
