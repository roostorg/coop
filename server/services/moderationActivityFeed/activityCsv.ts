import { type ModeratorActionGroupRecord } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type ManualReviewToolService } from '../manualReviewToolService/index.js';
import { type ActivityRow } from './mergeActivityRows.js';

type DecisionPayload = Awaited<
  ReturnType<ManualReviewToolService['getDecisionsForActivityFeed']>
>[number];

type DecisionComponent = DecisionPayload['decisions'][number];

export type ActivityCsvLookups = {
  actionNames: ReadonlyMap<string, string>;
  policyNames: ReadonlyMap<string, string>;
  queueNames: ReadonlyMap<string, string>;
  reviewerNames: ReadonlyMap<string, string>;
  uiUrl: string;
};

const DECISION_HEADERS = [
  'Decisions',
  'Policies',
  'Reviewer',
  'Queue',
  'Job Created At',
  'Claimed At',
  'Decision Time',
  'Wait Time (sec)',
  'Handle Time (sec)',
  'Decision Reason',
] as const;

const UTC_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

function escapeCsvField(value: string): string {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function formatUtc(date: Date | string | null | undefined): string {
  if (date == null) {
    return 'Unknown';
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return 'Unknown';
  }
  return UTC_FORMAT.format(d).replace(',', '');
}

function formatOptionalUtc(date: Date | string | null | undefined): string {
  return date == null ? '' : formatUtc(date);
}

function secondsBetween(later: Date | string, earlier: Date | string): number {
  return Math.round(
    (new Date(later).getTime() - new Date(earlier).getTime()) / 1000,
  );
}

function nameOf(names: ReadonlyMap<string, string>, id: string): string {
  return names.get(id) ?? 'Unknown';
}

function reviewerName(
  lookups: ActivityCsvLookups,
  reviewerId: string | null | undefined,
): string {
  return reviewerId ? nameOf(lookups.reviewerNames, reviewerId) : 'Automatic';
}

const BUILT_IN_DECISION_LABELS: Record<
  Exclude<DecisionComponent['type'], 'CUSTOM_ACTION'>,
  string
> = {
  IGNORE: 'Ignore',
  ACCEPT_APPEAL: 'Accept Appeal',
  REJECT_APPEAL: 'Reject Appeal',
  SUBMIT_NCMEC_REPORT: 'Report to NCMEC',
  TRANSFORM_JOB_AND_RECREATE_IN_QUEUE: 'Move to Different Queue',
  AUTOMATIC_CLOSE: 'Closed Automatically',
};

function describeDecision(
  component: DecisionComponent,
  lookups: ActivityCsvLookups,
): { labels: string[]; policies: string[] } {
  if (component.type === 'CUSTOM_ACTION') {
    return {
      labels: component.actionIds.map((id) => nameOf(lookups.actionNames, id)),
      policies: component.policyIds.map((id) =>
        nameOf(lookups.policyNames, id),
      ),
    };
  }
  return {
    labels: [BUILT_IN_DECISION_LABELS[component.type]],
    policies: component.type === 'SUBMIT_NCMEC_REPORT' ? ['Child Safety'] : [],
  };
}

function decisionFields(
  row: ActivityRow,
  lookups: ActivityCsvLookups,
): { shared: string[]; link: string } {
  const decision = row.payload as DecisionPayload;
  const { assignedAt, jobCreatedAt } = decision;
  const described = decision.decisions.map((it) =>
    describeDecision(it, lookups),
  );
  return {
    shared: [
      jsonStringify(described.flatMap((it) => it.labels)),
      jsonStringify(described.flatMap((it) => it.policies)),
      reviewerName(lookups, decision.reviewerId),
      decision.queueId ? nameOf(lookups.queueNames, decision.queueId) : '',
      formatOptionalUtc(jobCreatedAt),
      formatOptionalUtc(assignedAt),
      formatUtc(row.ts),
      assignedAt != null && jobCreatedAt != null
        ? String(secondsBetween(assignedAt, jobCreatedAt))
        : '',
      assignedAt != null ? String(secondsBetween(row.ts, assignedAt)) : '',
      decision.decisionReason ?? '',
    ],
    link: `${lookups.uiUrl}/dashboard/manual_review/recent?jobId=${decision.jobId}`,
  };
}

function actionFields(
  row: ActivityRow,
  lookups: ActivityCsvLookups,
): { shared: string[]; itemCount: string; failedCount: string } {
  const action = row.payload as ModeratorActionGroupRecord;
  return {
    shared: [
      jsonStringify(
        action.actionIds.map((id) => nameOf(lookups.actionNames, id)),
      ),
      jsonStringify(
        action.policyIds.map((id) => nameOf(lookups.policyNames, id)),
      ),
      reviewerName(lookups, action.actorId),
      '',
      '',
      '',
      formatUtc(row.ts),
      '',
      '',
      action.actorNote ?? '',
    ],
    itemCount: String(action.itemCount),
    failedCount: action.failedCount ? String(action.failedCount) : '',
  };
}

function toLine(fields: readonly string[]): string {
  return `${fields.map(escapeCsvField).join(',')}\n`;
}

export function activityCsvHeader(includeActions: boolean): string {
  return toLine([
    ...(includeActions ? ['Origin'] : []),
    ...DECISION_HEADERS,
    ...(includeActions ? ['Items', 'Failed'] : []),
    'Link',
  ]);
}

export function activityCsvLine(
  row: ActivityRow,
  includeActions: boolean,
  lookups: ActivityCsvLookups,
): string {
  if (row.kind === 'MANUAL_ACTION') {
    const { shared, itemCount, failedCount } = actionFields(row, lookups);
    return toLine([
      ...(includeActions ? ['Manual Action'] : []),
      ...shared,
      ...(includeActions ? [itemCount, failedCount] : []),
      '',
    ]);
  }
  const { shared, link } = decisionFields(row, lookups);
  return toLine([
    ...(includeActions ? ['Review Job'] : []),
    ...shared,
    ...(includeActions ? ['', ''] : []),
    link,
  ]);
}
