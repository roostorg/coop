import _Ajv from 'ajv-draft-04';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  type ActivityCsvLookups,
  type ActivityFeedFilterInput,
  type ActivityView,
} from '../../services/moderationActivityFeed/index.js';
import { type UserPermission } from '../../services/userManagementService/index.js';
import { tryJsonParse } from '../../utils/encoding.js';
import {
  makeBadRequestError,
  makeUnauthenticatedError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { streamActivityCsv } from './streamActivityCsv.js';

const Ajv = _Ajv as unknown as typeof _Ajv.default;
const ajv = new Ajv({ allErrors: true, strictSchema: true });

const MAX_EXPORT_SPAN_DAYS = 400;

type SessionUser = {
  id: string;
  orgId: string;
  getPermissions(): UserPermission[];
};

type DecisionType = NonNullable<
  ActivityFeedFilterInput['decisions']
>[number]['type'];

type ExportInput = {
  view?: ActivityView;
  startTime: string;
  endTime?: string;
  reviewerIds?: string[];
  policyIds?: string[];
  queueIds?: string[];
  decisions?: { type: DecisionType; actionIds?: string[] }[];
  userSearchString?: string;
};

const stringArray = { type: 'array', items: { type: 'string' } };

const validateExportInput = ajv.compile<ExportInput>({
  type: 'object',
  additionalProperties: false,
  required: ['startTime'],
  properties: {
    view: { type: 'string', enum: ['ALL', 'DECISIONS', 'ACTIONS'] },
    startTime: { type: 'string' },
    endTime: { type: 'string' },
    reviewerIds: stringArray,
    policyIds: stringArray,
    queueIds: stringArray,
    userSearchString: { type: 'string' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: { type: { type: 'string' }, actionIds: stringArray },
      },
    },
  },
});

function parseExportInput(raw: unknown): ExportInput | string {
  const parsed: unknown = typeof raw === 'string' ? tryJsonParse(raw) : raw;
  if (!validateExportInput(parsed)) {
    return '`input` must be JSON with a startTime and the activity feed filters.';
  }
  const start = new Date(parsed.startTime).getTime();
  const end =
    parsed.endTime === undefined
      ? Date.now()
      : new Date(parsed.endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return 'startTime and endTime must be valid dates, in order.';
  }
  if (end - start > MAX_EXPORT_SPAN_DAYS * 86_400_000) {
    return `The date range can't be longer than ${MAX_EXPORT_SPAN_DAYS} days.`;
  }
  return parsed;
}

function toFeedFilter(input: ExportInput): ActivityFeedFilterInput {
  return {
    startTime: new Date(input.startTime),
    endTime: input.endTime === undefined ? undefined : new Date(input.endTime),
    reviewerIds: input.reviewerIds,
    policyIds: input.policyIds,
    queueIds: input.queueIds,
    userSearchString: input.userSearchString,
    decisions: input.decisions?.map((it) =>
      it.type === 'CUSTOM_ACTION' || it.type === 'RELATED_ACTION'
        ? { type: it.type, actionIds: it.actionIds ?? [] }
        : { type: it.type, actionIds: undefined },
    ),
  };
}

async function loadLookups(
  deps: Dependencies,
  user: SessionUser,
): Promise<ActivityCsvLookups> {
  const [actions, policies, users, queues] = await Promise.all([
    deps.ModerationConfigService.getActions({
      orgId: user.orgId,
      readFromReplica: true,
    }),
    deps.ModerationConfigService.getPolicies({
      orgId: user.orgId,
      readFromReplica: true,
    }),
    deps.UserManagementService.getUserNamesForOrg(user.orgId),
    deps.ManualReviewToolService.getReviewableQueuesForUser({
      invoker: {
        userId: user.id,
        permissions: user.getPermissions(),
        orgId: user.orgId,
      },
    }),
  ]);
  return {
    actionNames: new Map(actions.map((it) => [it.id, it.name])),
    policyNames: new Map(policies.map((it) => [it.id, it.name])),
    queueNames: new Map(queues.map((it) => [it.id, it.name])),
    reviewerNames: new Map(
      users.map((it) => [it.id, `${it.firstName} ${it.lastName}`]),
    ),
    uiUrl: deps.ConfigService.uiUrl,
  };
}

export default function exportActivityCsv(
  deps: Dependencies,
): RequestHandlerWithBodies<never, undefined> {
  return async (req, res, next) => {
    const user = req.user as SessionUser | undefined;
    if (user == null) {
      return next(
        makeUnauthenticatedError('Authenticated user required', {
          shouldErrorSpan: false,
        }),
      );
    }

    const site = req.get('Sec-Fetch-Site');
    if (site === 'cross-site' || site === 'same-site') {
      return next(
        makeUnauthorizedError('Exports must be started from Coop.', {
          shouldErrorSpan: false,
        }),
      );
    }

    const input = parseExportInput(req.query['input']);
    if (typeof input === 'string') {
      return next(
        makeBadRequestError('Invalid export filters.', {
          shouldErrorSpan: false,
          detail: input,
        }),
      );
    }

    const view = input.view ?? 'ALL';
    const includeActions = view !== 'DECISIONS';

    try {
      const lookups = await loadLookups(deps, user);
      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${includeActions ? 'moderation-activity' : 'decisions'}.csv"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      await streamActivityCsv({
        pages: deps.ModerationActivityFeed.iterateAll({
          userPermissions: user.getPermissions(),
          orgId: user.orgId,
          input: toFeedFilter(input),
          view,
        }),
        out: res,
        includeActions,
        lookups,
      });
    } catch (e) {
      if (!res.headersSent) {
        return next(e);
      }
      const error = e instanceof Error ? e : new Error(String(e));
      res.destroy(error);
      return next(error);
    }
  };
}
