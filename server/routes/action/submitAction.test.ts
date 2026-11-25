import { vi } from 'vitest';

import { makeHandlerContext } from '../../test/adonisTestHelpers.js';
import submitAction from './submitAction.js';

function makeDeps(
  overrides?: Partial<{
    action: Record<string, unknown>;
    user: Record<string, unknown> | undefined;
  }>,
) {
  const action = overrides?.action ?? {
    id: 'action-1',
    orgId: 'org-1',
    name: 'Ban User',
    actionType: 'CUSTOM_ACTION',
    callbackUrl: 'https://example.com',
    callbackUrlHeaders: null,
    callbackUrlBody: null,
    applyUserStrikes: false,
    customMrtApiParams: [
      {
        name: 'num_days',
        displayName: 'Number of days',
        type: 'NUMBER',
        required: true,
      },
    ],
  };

  const publishActions = vi.fn().mockResolvedValue([]);
  const getActions = vi.fn().mockResolvedValue([action]);
  const getPolicies = vi.fn().mockResolvedValue([]);
  const getItemTypeEventuallyConsistent = vi.fn().mockResolvedValue({
    id: 'type-1',
    kind: 'CONTENT',
    name: 'Social Post',
  });
  const getGraphQLUserFromId = vi
    .fn()
    .mockResolvedValue(
      overrides?.user ?? { id: 'user-1', email: 'mod@example.com' },
    );

  const handler = submitAction({
    ActionPublisher: { publishActions },
    ModerationConfigService: { getActions, getPolicies },
    getItemTypeEventuallyConsistent,
    UserAPIDataSource: { getGraphQLUserFromId },
  } as never);

  return { handler, publishActions, getActions };
}

function makeRes() {
  return { status: vi.fn<(code: number) => void>(), end: vi.fn<() => void>() };
}
type Res = ReturnType<typeof makeRes>;

/**
 * Calls the handler with an AdonisJS context for org-1, reporting a thrown
 * error to `next` and the response status to `res`, so the assertions read
 * as they did against Express' `(req, res, next)`.
 */
async function callHandler(
  handler: ReturnType<typeof makeDeps>['handler'],
  body: Record<string, unknown>,
  res: Res,
  next: (err?: unknown) => void,
) {
  const ctx = makeHandlerContext({ orgId: 'org-1' });
  try {
    await handler(ctx, body as never);
    res.status(ctx.response.getStatus());
    res.end();
  } catch (e) {
    next(e);
  }
}

const validBody = {
  itemId: 'item-1',
  itemTypeId: 'type-1',
  actionId: 'action-1',
  parameters: { num_days: 7 },
  note: 'Repeat offender',
};

describe('submitAction (REST handler)', () => {
  it('forwards validated parameters and the moderator note to the publisher and 202s', async () => {
    const { handler, publishActions } = makeDeps();
    const res = makeRes();
    const next = vi.fn();

    await callHandler(handler, validBody, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(publishActions).toHaveBeenCalledTimes(1);
    const [triggered, ctx] = publishActions.mock.calls[0];
    expect(triggered[0].customMrtApiParamDecisionPayload).toEqual({
      num_days: 7,
    });
    expect(ctx.actorNote).toBe('Repeat offender');
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects (next() with a 400) when a required parameter is missing, and never publishes', async () => {
    const { handler, publishActions } = makeDeps();
    const res = makeRes();
    const next = vi.fn();

    await callHandler(handler, { ...validBody, parameters: {} }, res, next);

    expect(publishActions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as { status?: number; message?: string };
    expect(err.status).toBe(400);
  });

  it('rejects unknown parameter keys with a 400', async () => {
    const { handler, publishActions } = makeDeps();
    const res = makeRes();
    const next = vi.fn();

    await callHandler(
      handler,
      {
        ...validBody,
        parameters: { num_days: 7, bogus: 'x' },
      },
      res,
      next,
    );

    expect(publishActions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as { status?: number }).status).toBe(400);
  });

  it('rejects type-mismatched parameter values with a 400', async () => {
    const { handler, publishActions } = makeDeps();
    const res = makeRes();
    const next = vi.fn();

    await callHandler(
      handler,
      {
        ...validBody,
        parameters: { num_days: 'seven' },
      },
      res,
      next,
    );

    expect(publishActions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as { status?: number }).status).toBe(400);
  });

  it('publishes successfully when parameters are absent and the action has no spec', async () => {
    const { handler, publishActions } = makeDeps({
      action: {
        id: 'action-1',
        orgId: 'org-1',
        name: 'Plain Action',
        actionType: 'CUSTOM_ACTION',
        callbackUrl: 'https://example.com',
        callbackUrlHeaders: null,
        callbackUrlBody: null,
        applyUserStrikes: false,
        customMrtApiParams: null,
      },
    });
    const res = makeRes();
    const next = vi.fn();

    await callHandler(
      handler,
      {
        itemId: 'item-1',
        itemTypeId: 'type-1',
        actionId: 'action-1',
      },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(publishActions).toHaveBeenCalledTimes(1);
    const [triggered, ctx] = publishActions.mock.calls[0];
    expect(triggered[0].customMrtApiParamDecisionPayload).toBeUndefined();
    expect(ctx.actorNote).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(202);
  });
});
