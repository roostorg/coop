import { type Request, type Response } from 'express';

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

  const publishActions = jest.fn().mockResolvedValue([]);
  const getActions = jest.fn().mockResolvedValue([action]);
  const getPolicies = jest.fn().mockResolvedValue([]);
  const getItemTypeEventuallyConsistent = jest.fn().mockResolvedValue({
    id: 'type-1',
    kind: 'CONTENT',
    name: 'Social Post',
  });
  const getGraphQLUserFromId = jest
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

function makeReq(body: Record<string, unknown>): Request {
  return {
    orgId: 'org-1',
    body,
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
  return res as unknown as Response;
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
    const next = jest.fn();

    await handler(makeReq(validBody), res, next);

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
    const next = jest.fn();

    await handler(makeReq({ ...validBody, parameters: {} }), res, next);

    expect(publishActions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as { status?: number; message?: string };
    expect(err.status).toBe(400);
  });

  it('rejects unknown parameter keys with a 400', async () => {
    const { handler, publishActions } = makeDeps();
    const res = makeRes();
    const next = jest.fn();

    await handler(
      makeReq({
        ...validBody,
        parameters: { num_days: 7, bogus: 'x' },
      }),
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
    const next = jest.fn();

    await handler(
      makeReq({
        ...validBody,
        parameters: { num_days: 'seven' },
      }),
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
    const next = jest.fn();

    await handler(
      makeReq({
        itemId: 'item-1',
        itemTypeId: 'type-1',
        actionId: 'action-1',
      }),
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
