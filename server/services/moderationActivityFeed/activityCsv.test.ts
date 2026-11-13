import {
  activityCsvHeader,
  activityCsvLine,
  type ActivityCsvLookups,
} from './activityCsv.js';
import { type ActivityRow } from './mergeActivityRows.js';

const lookups: ActivityCsvLookups = {
  actionNames: new Map([['act-1', 'Ban User']]),
  policyNames: new Map([['pol-1', 'Spam']]),
  queueNames: new Map([['q-1', 'Default Queue']]),
  reviewerNames: new Map([['u-1', 'Ada Lovelace']]),
  uiUrl: 'https://coop.example',
};

const decisionRow = (payload: Record<string, unknown>): ActivityRow => ({
  kind: 'DECISION',
  id: 'd-1',
  ts: new Date('2026-08-05T14:00:00Z'),
  payload: {
    id: 'd-1',
    jobId: 'job-1',
    queueId: 'q-1',
    reviewerId: 'u-1',
    decisions: [
      {
        type: 'CUSTOM_ACTION',
        actionIds: ['act-1'],
        policyIds: ['pol-1'],
      },
    ],
    decisionReason: 'looks spammy',
    assignedAt: new Date('2026-08-05T13:59:00Z'),
    jobCreatedAt: new Date('2026-08-05T13:58:00Z'),
    createdAt: new Date('2026-08-05T14:00:00Z'),
    ...payload,
  },
});

const actionRow = (payload: Record<string, unknown>): ActivityRow => ({
  kind: 'MANUAL_ACTION',
  id: 'manual-action-run:abc',
  ts: new Date('2026-08-05T14:00:00Z'),
  payload: {
    correlationId: 'manual-action-run:abc',
    actorId: 'u-1',
    itemTypeId: 'it-1',
    actionIds: ['act-1'],
    policyIds: ['pol-1'],
    actorNote: 'bulk cleanup',
    itemCount: 84,
    failedCount: 3,
    occurredAt: new Date('2026-08-05T14:00:00Z'),
    ...payload,
  },
});

describe('activityCsvHeader', () => {
  it('adds Origin, Items and Failed only when actions are included', () => {
    expect(activityCsvHeader(false)).toBe(
      '"Decisions","Policies","Reviewer","Queue","Job Created At","Claimed At","Decision Time","Wait Time (sec)","Handle Time (sec)","Decision Reason","Link"\n',
    );
    expect(activityCsvHeader(true)).toBe(
      '"Origin","Decisions","Policies","Reviewer","Queue","Job Created At","Claimed At","Decision Time","Wait Time (sec)","Handle Time (sec)","Decision Reason","Items","Failed","Link"\n',
    );
  });
});

describe('activityCsvLine', () => {
  it('formats a review job decision with and without action columns', () => {
    expect(activityCsvLine(decisionRow({}), true, lookups)).toBe(
      '"Review Job","[""Ban User""]","[""Spam""]","Ada Lovelace","Default Queue","08/05/26 01:58:00 PM","08/05/26 01:59:00 PM","08/05/26 02:00:00 PM","60","60","looks spammy","","","https://coop.example/dashboard/manual_review/recent?jobId=job-1"\n',
    );
    expect(activityCsvLine(decisionRow({}), false, lookups)).toBe(
      '"[""Ban User""]","[""Spam""]","Ada Lovelace","Default Queue","08/05/26 01:58:00 PM","08/05/26 01:59:00 PM","08/05/26 02:00:00 PM","60","60","looks spammy","https://coop.example/dashboard/manual_review/recent?jobId=job-1"\n',
    );
  });

  it('formats a manual action', () => {
    expect(activityCsvLine(actionRow({}), true, lookups)).toBe(
      '"Manual Action","[""Ban User""]","[""Spam""]","Ada Lovelace","","","","08/05/26 02:00:00 PM","","","bulk cleanup","84","3",""\n',
    );
  });

  it.each([
    [{ type: 'IGNORE' }, 'Ignore', '[]'],
    [{ type: 'ACCEPT_APPEAL', appealId: 'a' }, 'Accept Appeal', '[]'],
    [{ type: 'REJECT_APPEAL', appealId: 'a' }, 'Reject Appeal', '[]'],
    [
      { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE' },
      'Move to Different Queue',
      '[]',
    ],
    [{ type: 'AUTOMATIC_CLOSE' }, 'Closed Automatically', '[]'],
    [{ type: 'SUBMIT_NCMEC_REPORT' }, 'Report to NCMEC', '[""Child Safety""]'],
  ])('labels %o as %s', (component, label, policies) => {
    const line = activityCsvLine(
      decisionRow({ decisions: [component] }),
      false,
      lookups,
    );
    expect(line.startsWith(`"[""${label}""]","${policies}",`)).toBe(true);
  });

  it('falls back to Automatic, Unknown and blank timing', () => {
    expect(
      activityCsvLine(
        decisionRow({ reviewerId: '', assignedAt: null, jobCreatedAt: null }),
        false,
        lookups,
      ),
    ).toContain(
      '"Automatic","Default Queue","","","08/05/26 02:00:00 PM","","",',
    );
    expect(
      activityCsvLine(
        decisionRow({
          reviewerId: 'gone',
          queueId: 'gone',
          decisions: [
            { type: 'CUSTOM_ACTION', actionIds: ['gone'], policyIds: ['gone'] },
          ],
        }),
        false,
        lookups,
      ),
    ).toMatch(/^"\[""Unknown""\]","\[""Unknown""\]","Unknown","Unknown",/);
  });

  it('neutralizes formula-looking free text', () => {
    expect(
      activityCsvLine(
        decisionRow({ decisionReason: '=HYPERLINK("http://evil")' }),
        false,
        lookups,
      ),
    ).toContain('"\'=HYPERLINK(""http://evil"")"');
  });
});
