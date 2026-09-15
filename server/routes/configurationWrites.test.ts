import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';

import { type Dependencies } from '../iocContainer/index.js';
import { makeItemTypeNameAlreadyExistsError } from '../services/moderationConfigService/index.js';
import { createBodySchemaValidator } from '../utils/bodySchemaValidation.js';
import { sanitizeError } from '../utils/errors.js';
import actions from './action/ActionRoutes.js';
import itemTypes from './item_types/ItemTypeRoutes.js';
import policies from './policies/PoliciesRoutes.js';

const orgId = 'org-1';
const apiKey = 'valid-key';
const field = {
  name: 'title',
  type: 'STRING',
  required: true,
  container: null,
} as const;
const item = {
  id: 'item-type-1',
  orgId,
  kind: 'CONTENT',
  name: 'Post',
  description: null,
  schema: [field],
  schemaFieldRoles: { displayName: 'title' },
  version: 'version-1',
  schemaVariant: 'original',
} as const;
const { orgId: _itemOrgId, ...publicItem } = item;
const policy = {
  id: 'policy-1',
  orgId,
  name: 'Spam',
  parentId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  policyText: null,
  enforcementGuidelines: null,
  policyType: null,
  semanticVersion: 1,
  userStrikeCount: 0,
  applyUserStrikeCountConfigToChildren: false,
  penalty: 'NONE',
} as const;
const action = {
  id: 'action-1',
  orgId,
  name: 'Remove',
  description: null,
  actionType: 'CUSTOM_ACTION',
  callbackUrl: 'https://example.com/remove',
  callbackUrlHeaders: null,
  callbackUrlBody: null,
  customMrtApiParams: null,
  applyUserStrikes: false,
  penalty: 'NONE',
} as const;

function harness() {
  const service = {
    createContentType: jest.fn().mockResolvedValue(item),
    createThreadType: jest.fn().mockResolvedValue(item),
    createUserType: jest.fn().mockResolvedValue(item),
    getItemType: jest.fn().mockResolvedValue(item),
    updateContentType: jest.fn().mockResolvedValue(item),
    updateThreadType: jest.fn().mockResolvedValue(item),
    updateUserType: jest.fn().mockResolvedValue(item),
    createPolicy: jest.fn().mockResolvedValue(policy),
    getPolicy: jest.fn().mockResolvedValue(policy),
    updatePolicy: jest.fn().mockResolvedValue(policy),
    createAction: jest.fn().mockResolvedValue(action),
    updateCustomAction: jest.fn().mockResolvedValue(action),
    getActionItemTypeIds: jest
      .fn()
      .mockResolvedValue(new Map([[action.id, [item.id]]])),
    getActions: jest.fn().mockResolvedValue([]),
  };
  const apiKeys = {
    validateApiKey: jest
      .fn()
      .mockImplementation(async (key: string) =>
        key === apiKey ? orgId : null,
      ),
  };
  const deps = {
    ApiKeyService: apiKeys,
    ModerationConfigService: service,
  } as unknown as Dependencies;
  const app = express();
  app.use(express.json());
  for (const controller of [itemTypes, policies, actions]) {
    for (const definition of controller.routes) {
      const handler = definition.handler(deps);
      const handlers = Array.isArray(handler) ? handler : [handler];
      app[definition.method](
        `/api/v1${controller.pathPrefix}${definition.path}`,
        ...(definition.bodySchema
          ? [createBodySchemaValidator(definition.bodySchema), ...handlers]
          : handlers),
      );
    }
  }
  app.use(((error, _req, res, _next) => {
    const safe = sanitizeError(error);
    res.status(safe.status).json({ errors: [safe] });
  }) satisfies ErrorRequestHandler);
  return { app, service, apiKeys };
}

// Supertest's chainable Test is thenable, but awaiting it would execute the request.
// eslint-disable-next-line @typescript-eslint/promise-function-async
const auth = (testRequest: request.Test) =>
  testRequest.set('x-api-key', apiKey);

describe('configuration write REST routes', () => {
  it('creates an item type and returns only its public representation', async () => {
    const { app, service } = harness();
    const response = await auth(request(app).post('/api/v1/item_types/'))
      .send({
        kind: 'CONTENT',
        name: 'Post',
        schema: [field],
        schemaFieldRoles: { displayName: 'title' },
      })
      .expect(201);

    expect(response.body).toEqual(publicItem);
    expect(service.createContentType).toHaveBeenCalledWith(orgId, {
      name: 'Post',
      description: null,
      schema: [field],
      schemaFieldRoles: { displayName: 'title' },
      hiddenFields: [],
    });
  });

  it('patches an item type, omitting roles or completely clearing supplied roles', async () => {
    const { app, service } = harness();
    await auth(request(app).patch(`/api/v1/item_types/${item.id}`))
      .send({ name: 'Renamed', hiddenFields: [] })
      .expect(200, publicItem);
    expect(service.updateContentType).toHaveBeenLastCalledWith(orgId, {
      id: item.id,
      name: 'Renamed',
      hiddenFields: [],
    });

    await auth(request(app).patch(`/api/v1/item_types/${item.id}`))
      .send({ schemaFieldRoles: {} })
      .expect(200);
    expect(service.updateContentType).toHaveBeenLastCalledWith(orgId, {
      id: item.id,
      schemaFieldRoles: {
        displayName: null,
        createdAt: null,
        creatorId: null,
        isDeleted: null,
        ipAddress: null,
        parentId: null,
        threadId: null,
      },
    });
  });

  it('creates a policy with the API-key actor and exact public output', async () => {
    const { app, service } = harness();
    const response = await auth(request(app).post('/api/v1/policies/'))
      .send({ name: 'Spam' })
      .expect(201);
    expect(response.body).toEqual({
      id: 'policy-1',
      name: 'Spam',
      parentId: null,
      policyText: null,
      enforcementGuidelines: null,
      policyType: null,
      semanticVersion: 1,
      userStrikeCount: 0,
      applyUserStrikeCountConfigToChildren: false,
      penalty: 'NONE',
    });
    expect(service.createPolicy).toHaveBeenCalledWith({
      orgId,
      policy: {
        name: 'Spam',
        parentId: null,
        policyText: null,
        enforcementGuidelines: null,
        policyType: null,
      },
      actor: { type: 'organizationApiKey', orgId },
    });
  });

  it('patches a policy for its organization with the API-key actor', async () => {
    const { app, service } = harness();
    await auth(request(app).patch(`/api/v1/policies/${policy.id}`))
      .send({ policyText: null })
      .expect(200);
    expect(service.getPolicy).toHaveBeenCalledWith({
      orgId,
      policyId: policy.id,
      readFromReplica: false,
    });
    expect(service.updatePolicy).toHaveBeenCalledWith({
      orgId,
      policy: { id: policy.id, policyText: null },
      actor: { type: 'organizationApiKey', orgId },
    });
  });

  it('creates a custom action with defaults and exact public output', async () => {
    const { app, service } = harness();
    const response = await auth(request(app).post('/api/v1/actions/custom'))
      .send({ name: 'Remove', callbackUrl: action.callbackUrl })
      .expect(201);
    expect(response.body).toEqual({
      id: action.id,
      name: 'Remove',
      description: null,
      actionType: 'CUSTOM_ACTION',
      applyUserStrikes: false,
      penalty: 'NONE',
      itemTypeIds: [],
      parameters: [],
    });
    expect(service.createAction).toHaveBeenCalledWith(orgId, {
      name: 'Remove',
      description: null,
      itemTypeIds: [],
      callbackUrl: action.callbackUrl,
      callbackUrlHeaders: null,
      callbackUrlBody: null,
      applyUserStrikes: false,
      parameters: [],
      type: 'CUSTOM_ACTION',
    });
  });

  it('patches custom action nullable objects and replaces arrays', async () => {
    const { app, service } = harness();
    const parameters = [
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'STRING',
        required: false,
      },
    ];
    await auth(request(app).patch(`/api/v1/actions/${action.id}`))
      .send({
        callbackUrlHeaders: null,
        callbackUrlBody: { reason: '{{reason}}' },
        itemTypeIds: [],
        parameters,
      })
      .expect(200);
    expect(service.updateCustomAction).toHaveBeenCalledWith(orgId, {
      actionId: action.id,
      patch: {
        callbackUrlHeaders: null,
        callbackUrlBody: { reason: '{{reason}}' },
        parameters,
      },
      itemTypeIds: [],
    });
    expect(service.getActionItemTypeIds).toHaveBeenCalledWith({ orgId });
  });

  it.each([
    [
      'post',
      '/api/v1/item_types/',
      { kind: 'CONTENT', name: 'Post', schema: [field], schemaFieldRoles: {} },
    ],
    ['patch', `/api/v1/item_types/${item.id}`, { name: 'Post' }],
    ['post', '/api/v1/policies/', { name: 'Spam' }],
    ['patch', `/api/v1/policies/${policy.id}`, { name: 'Spam' }],
    [
      'post',
      '/api/v1/actions/custom',
      { name: 'Remove', callbackUrl: action.callbackUrl },
    ],
    ['patch', `/api/v1/actions/${action.id}`, { name: 'Remove' }],
  ] as const)(
    '%s %s rejects missing authentication',
    async (method, url, body) => {
      const { app, service } = harness();
      const response = await request(app)[method](url).send(body).expect(401);
      expect(response.body.errors[0]).toMatchObject({
        status: 401,
        title: 'Invalid API Key',
        type: ['/errors/authentication-failed-or-missing'],
      });
      expect(
        Object.values(service).every((mock) => mock.mock.calls.length === 0),
      ).toBe(true);
    },
  );

  it.each([
    [
      'item create missing required roles',
      'post',
      '/api/v1/item_types/',
      { kind: 'CONTENT', name: 'Post', schema: [field] },
    ],
    [
      'item patch immutable kind',
      'patch',
      `/api/v1/item_types/${item.id}`,
      { kind: 'USER' },
    ],
    [
      'policy create unknown orgId',
      'post',
      '/api/v1/policies/',
      { name: 'Spam', orgId: 'other' },
    ],
    [
      'policy patch unknown id field',
      'patch',
      `/api/v1/policies/${policy.id}`,
      { id: 'other' },
    ],
    [
      'action create malformed callback object',
      'post',
      '/api/v1/actions/custom',
      { name: 'Remove', callbackUrl: action.callbackUrl, callbackUrlBody: [] },
    ],
    [
      'action patch malformed parameters',
      'patch',
      `/api/v1/actions/${action.id}`,
      { parameters: {} },
    ],
  ] as const)(
    'rejects %s before calling a service',
    async (_name, method, url, body) => {
      const { app, service } = harness();
      const response = await auth(request(app)[method](url))
        .send(body)
        .expect(400);
      expect(response.body.errors[0]).toMatchObject({
        status: 400,
        title: 'Request body failed schema validation.',
      });
      expect(
        Object.values(service).every((mock) => mock.mock.calls.length === 0),
      ).toBe(true);
    },
  );

  it.each([
    ['item type', `/api/v1/item_types/${item.id}`, 'getItemType'],
    ['policy', `/api/v1/policies/${policy.id}`, 'getPolicy'],
  ] as const)(
    'returns 404 for a foreign or missing %s before mutation',
    async (_name, url, lookup) => {
      const { app, service } = harness();
      service[lookup].mockResolvedValueOnce(undefined);
      await auth(request(app).patch(url)).send({ name: 'Renamed' }).expect(404);
      expect(service.updateContentType).not.toHaveBeenCalled();
      expect(service.updatePolicy).not.toHaveBeenCalled();
    },
  );

  it('propagates a service conflict response', async () => {
    const { app, service } = harness();
    service.createContentType.mockRejectedValueOnce(
      makeItemTypeNameAlreadyExistsError({ shouldErrorSpan: false }),
    );
    const response = await auth(request(app).post('/api/v1/item_types/'))
      .send({
        kind: 'CONTENT',
        name: 'Post',
        schema: [field],
        schemaFieldRoles: {},
      })
      .expect(409);
    expect(response.body.errors).toEqual([
      {
        status: 409,
        type: ['/errors/unique-violation'],
        title:
          'An item type with that name already exists in this organization.',
      },
    ]);
  });

  it('keeps POST /actions mapped to submitAction rather than createAction', async () => {
    const { app, service } = harness();
    await auth(request(app).post('/api/v1/actions/'))
      .send({ actionId: action.id, itemId: 'post-1', itemTypeId: item.id })
      .expect(500);
    expect(service.getActions).toHaveBeenCalledWith({
      orgId,
      ids: [action.id],
      readFromReplica: true,
    });
    expect(service.createAction).not.toHaveBeenCalled();
  });
});
