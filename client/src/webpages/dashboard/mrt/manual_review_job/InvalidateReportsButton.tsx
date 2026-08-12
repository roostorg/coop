import { Button } from '@/coop-ui/Button';
import { Checkbox } from '@/coop-ui/Checkbox';
import { useGQLInvalidateReportsFromReporterMutation } from '@/graphql/generated';
import { gql } from '@apollo/client';
import { Input, message } from 'antd';
import { ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import CoopModal from '../../components/CoopModal';

gql`
  mutation InvalidateReportsFromReporter(
    $input: InvalidateReportsFromReporterInput!
  ) {
    invalidateReportsFromReporter(input: $input) {
      queuesScanned
      jobsScanned
      jobsScrubbed
      jobsDeleted
      reportsRemoved
      truncated
    }
  }
`;

/**
 * Action button to invalidate reports from a given `reporter`. When `jobId`
 * is set the modal defaults to "this job only"; reviewers can opt in to
 * sweeping every pending job in the org with a checkbox. Without `jobId`
 * the action is always org-wide. Gated on EDIT_MRT_QUEUES; non-persistent (#404).
 */
export default function InvalidateReportsButton(props: {
  reporter: { id: string; typeId: string };
  reporterDisplayName?: string;
  jobId?: string;
  /**
   * Fired after the mutation resolves. The button awaits the returned
   * promise so the modal spinner stays up while the parent refreshes the
   * job view and advances to the next item if this job was deleted.
   */
  onInvalidated?: () => Promise<void> | void;
}) {
  const { reporter, reporterDisplayName, jobId, onInvalidated } = props;
  const supportsScopeChoice = jobId != null;
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [expandToOrg, setExpandToOrg] = useState(false);
  // Covers the mutation plus the parent's onInvalidated handler.
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReason('');
      setExpandToOrg(false);
    }
  }, [visible]);

  const scopedToCurrentJob = supportsScopeChoice && !expandToOrg;

  const [invalidateReports] = useGQLInvalidateReportsFromReporterMutation({
    onError: (err) => {
      // Avoid surfacing raw server error messages to the reviewer; log
      // detail to the console for debugging.
      // eslint-disable-next-line no-console
      console.error('[InvalidateReportsButton] mutation failed', err);
      message.error(
        'Could not invalidate reports. Please try again or contact support.',
      );
    },
    onCompleted: (data) => {
      const result = data.invalidateReportsFromReporter;
      message.success(
        formatSuccessMessage({
          reportsRemoved: result.reportsRemoved,
          jobsDeleted: result.jobsDeleted,
          scope: scopedToCurrentJob ? 'currentJob' : 'orgWide',
        }),
      );
      if (result.truncated) {
        message.warning(
          'Some queues had more reports than could be processed in one pass. Run the action again to continue.',
        );
      }
    },
  });

  const onConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      // Await the mutation before handing off so the parent's refresh and
      // advance run strictly after the server has settled.
      await invalidateReports({
        variables: {
          input: {
            reporter,
            reason: reason.trim() ? reason.trim() : undefined,
            jobId: scopedToCurrentJob ? jobId : undefined,
          },
        },
      });
      await onInvalidated?.();
    } catch (err) {
      // Mutation errors are handled by `onError`; this catches follow-up
      // failures from the parent handler.
      // eslint-disable-next-line no-console
      console.error(
        '[InvalidateReportsButton] post-invalidate handler failed',
        err,
      );
    } finally {
      setSubmitting(false);
      setVisible(false);
    }
  }, [
    invalidateReports,
    reporter,
    reason,
    scopedToCurrentJob,
    jobId,
    onInvalidated,
  ]);

  const displayLabel = reporterDisplayName ?? reporter.id;
  const buttonLabel = supportsScopeChoice
    ? 'Invalidate reports'
    : 'Invalidate all reports from this reporter';

  return (
    <>
      <Button
        size="sm"
        variant="link"
        color="gray"
        startIcon={ShieldOff}
        onClick={() => setVisible(true)}
        aria-label={buttonLabel}
        disabled={submitting}
      >
        {buttonLabel}
      </Button>
      <CoopModal
        title="Invalidate reports"
        visible={visible}
        onClose={submitting ? undefined : () => setVisible(false)}
        footer={[
          {
            title: 'Cancel',
            onClick: () => setVisible(false),
            type: 'secondary',
            disabled: submitting,
          },
          {
            title: 'Invalidate',
            onClick: onConfirm,
            disabled: submitting,
            loading: submitting,
          },
        ]}
      >
        <div className="space-y-3 w-[32rem] max-w-full">
          <p>
            {scopedToCurrentJob ? (
              <>
                This removes every report from{' '}
                <strong className="break-all">{displayLabel}</strong> on this
                review job. If they were the only reporter, the job is removed
                from the queue.
              </>
            ) : (
              <>
                This removes every report from{' '}
                <strong className="break-all">{displayLabel}</strong> across
                every pending review job in your org. Jobs whose only reporter
                was this user will be removed; jobs with other reporters will
                remain.
              </>
            )}
          </p>
          <label
            className="text-sm font-medium block"
            htmlFor="invalidate-reports-reason"
          >
            Reason (optional, logged for audit)
          </label>
          <Input.TextArea
            id="invalidate-reports-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. mass-flagging non-violating content"
            rows={3}
            maxLength={500}
          />
          <p className="text-sm text-slate-500">
            Future reports from this user will still land normally; re-run this
            action if needed.
          </p>
          {supportsScopeChoice ? (
            <label className="flex items-start gap-x-2 text-sm pt-1">
              <Checkbox
                id="invalidate-reports-expand-scope"
                checked={expandToOrg}
                onCheckedChange={setExpandToOrg}
                className="mt-0.5"
              />
              <span>
                Also invalidate this reporter's reports on every other pending
                job in the org
              </span>
            </label>
          ) : null}
        </div>
      </CoopModal>
    </>
  );
}

function formatSuccessMessage(opts: {
  reportsRemoved: number;
  jobsDeleted: number;
  scope: 'currentJob' | 'orgWide';
}): string {
  const { reportsRemoved, jobsDeleted, scope } = opts;
  if (reportsRemoved === 0) {
    return 'No reports from this user were found.';
  }
  const reportWord = reportsRemoved === 1 ? 'report' : 'reports';
  if (scope === 'currentJob') {
    return jobsDeleted > 0
      ? `Removed ${reportsRemoved} ${reportWord}. This job had no other reporters and was cleared from the queue.`
      : `Removed ${reportsRemoved} ${reportWord} from this job.`;
  }
  const base = `Removed ${reportsRemoved} ${reportWord} from this reporter.`;
  if (jobsDeleted === 0) {
    return base;
  }
  const jobWord = jobsDeleted === 1 ? 'job' : 'jobs';
  return `${base} ${jobsDeleted} ${jobWord} had no other reporters and ${
    jobsDeleted === 1 ? 'was' : 'were'
  } cleared from the queue.`;
}
