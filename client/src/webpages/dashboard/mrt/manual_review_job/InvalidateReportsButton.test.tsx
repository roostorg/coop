import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLInvalidateReportsFromReporterDocument,
  type GQLInvalidateReportsFromReporterMutation,
  type GQLInvalidateReportsFromReporterMutationVariables,
} from '@/graphql/generated';

import InvalidateReportsButton from './InvalidateReportsButton';

const reporter = { id: 'bad_reporter', typeId: 'user_type' };

function successData(
  overrides: Partial<
    Omit<
      GQLInvalidateReportsFromReporterMutation['invalidateReportsFromReporter'],
      '__typename'
    >
  > = {},
): GQLInvalidateReportsFromReporterMutation {
  return {
    __typename: 'Mutation',
    invalidateReportsFromReporter: {
      __typename: 'InvalidateReportsFromReporterSuccessResponse',
      queuesScanned: 1,
      jobsScanned: 1,
      jobsScrubbed: 1,
      jobsDeleted: 0,
      reportsRemoved: 1,
      truncated: false,
      ...overrides,
    },
  };
}

describe('InvalidateReportsButton', () => {
  it('renders the trigger button', () => {
    render(
      <MockedProvider mocks={[]}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
        />
      </MockedProvider>,
    );
    expect(
      screen.getByRole('button', { name: /invalidate.*reports/i }),
    ).toBeInTheDocument();
  });

  it('shows the org-wide copy and no scope checkbox when no jobId is provided', () => {
    render(
      <MockedProvider mocks={[]}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /invalidate.*reports/i }),
    );
    expect(screen.getByText(/Bad Actor/)).toBeInTheDocument();
    expect(
      screen.getByText(/across every pending review job in your org/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Also invalidate this reporter's reports/i),
    ).not.toBeInTheDocument();
  });

  it('shows the single-job copy and a scope checkbox when jobId is provided', () => {
    render(
      <MockedProvider mocks={[]}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
          jobId="job_1"
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^invalidate reports$/i }),
    );
    expect(screen.getByText(/on this review job/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Also invalidate this reporter's reports/i),
    ).toBeInTheDocument();
  });

  it('sends jobId in variables when scoped to the current job (default)', async () => {
    const variables: GQLInvalidateReportsFromReporterMutationVariables = {
      input: { reporter, jobId: 'job_1' },
    };
    let calledVariables: typeof variables | undefined;
    const mocks = [
      {
        request: { query: GQLInvalidateReportsFromReporterDocument, variables },
        result: () => {
          calledVariables = variables;
          return { data: successData() };
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
          jobId="job_1"
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^invalidate reports$/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^invalidate$/i }));

    await waitFor(() => {
      expect(calledVariables).toBeDefined();
    });
    expect(calledVariables?.input.jobId).toBe('job_1');
  });

  it('omits jobId when the reviewer expands the scope to the org', async () => {
    const variables: GQLInvalidateReportsFromReporterMutationVariables = {
      input: { reporter, jobId: undefined },
    };
    let calledVariables: typeof variables | undefined;
    const mocks = [
      {
        request: { query: GQLInvalidateReportsFromReporterDocument, variables },
        result: () => {
          calledVariables = variables;
          return { data: successData() };
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
          jobId="job_1"
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^invalidate reports$/i }),
    );
    fireEvent.click(
      screen.getByLabelText(/Also invalidate this reporter's reports/i),
    );
    fireEvent.click(screen.getByRole('button', { name: /^invalidate$/i }));

    await waitFor(() => {
      expect(calledVariables).toBeDefined();
    });
    expect(calledVariables?.input.jobId).toBeUndefined();
  });

  it('awaits onInvalidated after the mutation resolves', async () => {
    const variables: GQLInvalidateReportsFromReporterMutationVariables = {
      input: { reporter, jobId: 'job_1' },
    };
    const mutationOrder: string[] = [];
    const mocks = [
      {
        request: { query: GQLInvalidateReportsFromReporterDocument, variables },
        result: () => {
          mutationOrder.push('mutation');
          return { data: successData({ jobsDeleted: 1 }) };
        },
      },
    ];

    let resolveHandler: (() => void) | undefined;
    const onInvalidated = jest.fn(
      async () =>
        new Promise<void>((resolve) => {
          mutationOrder.push('handler-start');
          resolveHandler = resolve;
        }),
    );

    render(
      <MockedProvider mocks={mocks}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
          jobId="job_1"
          onInvalidated={onInvalidated}
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^invalidate reports$/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^invalidate$/i }));

    await waitFor(() => expect(onInvalidated).toHaveBeenCalled());
    expect(mutationOrder).toEqual(['mutation', 'handler-start']);

    resolveHandler?.();
  });

  it('sends a trimmed reason on confirm', async () => {
    const variables: GQLInvalidateReportsFromReporterMutationVariables = {
      input: { reporter, reason: 'mass-flagging' },
    };
    let calledVariables: typeof variables | undefined;
    const mocks = [
      {
        request: { query: GQLInvalidateReportsFromReporterDocument, variables },
        result: () => {
          calledVariables = variables;
          return { data: successData() };
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <InvalidateReportsButton
          reporter={reporter}
          reporterDisplayName="Bad Actor"
        />
      </MockedProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /invalidate.*reports/i }),
    );
    fireEvent.change(screen.getByLabelText(/reason \(optional/i), {
      target: { value: '   mass-flagging   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invalidate$/i }));

    await waitFor(() => {
      expect(calledVariables).toBeDefined();
    });
    expect(calledVariables?.input.reason).toBe('mass-flagging');
  });
});
