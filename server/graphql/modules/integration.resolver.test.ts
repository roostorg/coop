import {
  assertInputType,
  assertObjectType,
  buildASTSchema,
  coerceInputValue,
  graphqlSync,
  Kind,
  parse,
} from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import { resolvers, typeDefs } from './integration.js';
import { resolvers as catalogResolvers } from './integrationCatalog.js';

describe('Zentropi integration input', () => {
  // Use the actual SDL so this catches input nullability regressions, not just
  // resolver behavior after GraphQL has already accepted the request.
  const document = parse(typeDefs);
  const schema = buildASTSchema({
    ...document,
    definitions: document.definitions.filter(
      (definition) =>
        (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
          definition.kind === Kind.ENUM_TYPE_DEFINITION) &&
        definition.name.value.startsWith('Zentropi'),
    ),
  });
  const inputType = assertInputType(
    schema.getType('ZentropiIntegrationApiCredentialInput'),
  );

  it.each([
    {},
    { labelerId: null },
    { labelerId: '' },
    { labelerId: 'lb_123' },
  ])('accepts a version with optional labeler ID: %j', (optionalFields) => {
    const input = {
      apiKey: 'test-key',
      labelerVersions: [{ id: 'lv_123', label: 'Spam', ...optionalFields }],
    };
    expect(coerceInputValue(input, inputType)).toEqual(input);
  });

  it.each([{ id: 'lv_123' }, { label: 'Spam' }])(
    'still requires the version ID and display name: %j',
    (version) => {
      expect(() =>
        coerceInputValue(
          { apiKey: 'test-key', labelerVersions: [version] },
          inputType,
        ),
      ).toThrow(/was not provided/);
    },
  );

  it.each([{}, { model: null }, { model: 'COPE_B_S1' }])(
    'accepts a version with optional model: %j',
    (optionalFields) => {
      const input = {
        apiKey: 'test-key',
        labelerVersions: [{ id: 'lv_123', label: 'Spam', ...optionalFields }],
      };
      expect(coerceInputValue(input, inputType)).toEqual(input);
    },
  );

  it('rejects a model outside the ZentropiModel enum', () => {
    expect(() =>
      coerceInputValue(
        {
          apiKey: 'test-key',
          labelerVersions: [
            { id: 'lv_123', label: 'Spam', model: 'not-a-model' },
          ],
        },
        inputType,
      ),
    ).toThrow(/does not exist in "ZentropiModel" enum/);
  });
});

describe('Zentropi labeler version output', () => {
  // Use the actual SDL and resolver so this catches enum serialization errors,
  // which fail the whole integration settings query.
  const document = parse(typeDefs);
  const schema = buildASTSchema({
    ...document,
    definitions: [
      ...document.definitions.filter(
        (definition) =>
          (definition.kind === Kind.OBJECT_TYPE_DEFINITION &&
            definition.name.value === 'ZentropiLabelerVersion') ||
          (definition.kind === Kind.ENUM_TYPE_DEFINITION &&
            definition.name.value === 'ZentropiModel'),
      ),
      ...parse('type Query { version: ZentropiLabelerVersion }').definitions,
    ],
  });
  const modelField = assertObjectType(
    schema.getType('ZentropiLabelerVersion'),
  ).getFields()['model'];
  // eslint-disable-next-line functional/immutable-data -- wire the module's resolver into the test schema
  modelField.resolve = (
    resolvers.ZentropiLabelerVersion as {
      model: (it: { model?: string | null }) => string | null;
    }
  ).model;

  it.each([
    ['COPE_B_S1', 'COPE_B_S1'],
    [null, null],
    [undefined, null],
    ['COPE_FUTURE', null],
  ])('returns stored model %j as %j', (stored, expected) => {
    const result = graphqlSync({
      schema,
      source: '{ version { id model } }',
      rootValue: { version: { id: 'lv_123', label: 'Spam', model: stored } },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      version: { id: 'lv_123', model: expected },
    });
  });
});

type Resolver = (...args: unknown[]) => unknown;

const refreshIntegrationCatalog = (
  catalogResolvers.Mutation as { refreshIntegrationCatalog: Resolver }
).refreshIntegrationCatalog;
const setPluginIntegrationConfig = (
  resolvers.Mutation as { setPluginIntegrationConfig: Resolver }
).setPluginIntegrationConfig;

function context({
  user,
  supports = true,
  refresh = vi.fn(),
  setConfig = vi.fn(async () => ({ name: 'TEST' })),
}: {
  user?: { orgId: string; getPermissions: () => string[] };
  supports?: boolean;
  refresh?: ReturnType<typeof vi.fn>;
  setConfig?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    getUser: () => user,
    dataSources: {
      integrationAPI: {
        setConfigByIntegrationId: setConfig,
      },
    },
    services: {
      SignalsService: {
        supportsCatalogRefresh: () => supports,
        refreshPluginCatalog: refresh,
      },
      IntegrationContextSettingsService: { invalidate: vi.fn() },
    },
  };
}

const manager = {
  orgId: 'org-a',
  getPermissions: () => ['MANAGE_ORG'],
};

describe('integration catalog resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated catalog refreshes', async () => {
    await expect(
      refreshIntegrationCatalog({}, { integrationId: 'TEST' }, context()),
    ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
  });

  it('rejects catalog refreshes without MANAGE_ORG', async () => {
    await expect(
      refreshIntegrationCatalog(
        {},
        { integrationId: 'TEST' },
        context({
          user: { ...manager, getPermissions: () => [] },
        }),
      ),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  });

  it('returns unsupported integration errors', async () => {
    const result = await refreshIntegrationCatalog(
      {},
      { integrationId: 'MISSING' },
      context({ user: manager, supports: false }),
    );
    expect(result).toMatchObject({
      __typename: 'IntegrationConfigUnsupportedIntegrationError',
    });
  });

  it('maps successful refreshes', async () => {
    const fetchedAt = new Date();
    const refresh = vi.fn(async () => ({
      version: 'v1',
      signalCount: 2,
      fetchedAt,
      addedSignalTypeIds: ['A'],
      removedSignalTypeIds: ['B'],
    }));
    const result = await refreshIntegrationCatalog(
      {},
      { integrationId: 'TEST' },
      context({ user: manager, refresh }),
    );
    expect(result).toMatchObject({
      __typename: 'RefreshIntegrationCatalogSuccessResponse',
      integrationId: 'TEST',
      version: 'v1',
      signalCount: 2,
    });
  });

  it('maps store failures to safe catalog errors', async () => {
    const refresh = vi.fn(async () => {
      throw new CoopError({
        status: 400,
        name: 'IntegrationCatalogRefreshError',
        type: [ErrorType.InvalidUserInput],
        title: 'Integration catalog refresh failed.',
        detail: 'PLUGIN_ERROR',
        shouldErrorSpan: false,
      });
    });
    const result = await refreshIntegrationCatalog(
      {},
      { integrationId: 'TEST' },
      context({ user: manager, refresh }),
    );
    expect(result).toMatchObject({
      __typename: 'IntegrationCatalogRefreshError',
    });
  });

  it('does not fail config saves when automatic refresh fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const result = await setPluginIntegrationConfig(
      {},
      { input: { integrationId: 'TEST', credential: {} } },
      context({ user: manager, refresh }),
    );
    expect(result).toMatchObject({
      __typename: 'SetIntegrationConfigSuccessResponse',
    });
    expect(refresh).toHaveBeenCalledWith({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
  });

  it('saves the chosen catalog refresh interval', async () => {
    const setConfig = vi.fn(async () => ({ name: 'TEST' }));
    await setPluginIntegrationConfig(
      {},
      {
        input: {
          integrationId: 'TEST',
          credential: {},
          catalogRefreshInterval: 'WEEKLY',
        },
      },
      context({ user: manager, setConfig, refresh: vi.fn(async () => ({})) }),
    );

    expect(setConfig).toHaveBeenCalledWith(
      'TEST',
      {},
      'org-a',
      expect.objectContaining({ catalogRefreshInterval: 'WEEKLY' }),
    );
  });

  it('reads the saved interval, and null for plugins without a catalog', () => {
    const catalogRefreshInterval = (
      catalogResolvers.IntegrationConfig as { catalogRefreshInterval: Resolver }
    ).catalogRefreshInterval;
    const config = {
      name: 'TEST',
      apiCredential: { __coopCatalog: { refreshInterval: 'HOURLY' } },
    };

    expect(catalogRefreshInterval(config, {}, context({ user: manager }))).toBe(
      'HOURLY',
    );
    expect(
      catalogRefreshInterval(
        config,
        {},
        context({ user: manager, supports: false }),
      ),
    ).toBeNull();
  });
});

// The MANAGE_ORG check fires before any data-source or integration-registry
// lookup, so these tests exercise the forbidden path with a minimal mock ctx
// that never gets reached for the underlying API calls.

describe('integration resolvers', () => {
  function makeCtx(permissions: readonly UserPermission[]) {
    const getConfigWithMetadata = vi.fn();
    const setConfig = vi.fn();
    const setConfigByIntegrationId = vi.fn();
    const ctx = {
      getUser: () => ({
        id: 'user-1',
        orgId: 'org-1',
        getPermissions: () => permissions,
      }),
      dataSources: {
        integrationAPI: {
          getConfigWithMetadata,
          setConfig,
          setConfigByIntegrationId,
        },
      },
    };
    return { ctx, getConfigWithMetadata, setConfig, setConfigByIntegrationId };
  }

  it('Query.integrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, getConfigWithMetadata } = makeCtx([UserPermission.VIEW_MRT]);
    const Query = resolvers.Query as {
      integrationConfig: (
        parent: unknown,
        args: { name: string },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Query.integrationConfig({}, { name: 'OPEN_AI' }, ctx),
    ).rejects.toThrow(
      'User does not have permission to view integration configs',
    );
    expect(getConfigWithMetadata).not.toHaveBeenCalled();
  });

  it('Mutation.setIntegrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, setConfig } = makeCtx([UserPermission.VIEW_MRT]);
    const Mutation = resolvers.Mutation as {
      setIntegrationConfig: (
        parent: unknown,
        args: { input: unknown },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Mutation.setIntegrationConfig({}, { input: {} }, ctx),
    ).rejects.toThrow(
      'User does not have permission to update integration configs',
    );
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('Mutation.setPluginIntegrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, setConfigByIntegrationId } = makeCtx([
      UserPermission.VIEW_MRT,
    ]);
    const Mutation = resolvers.Mutation as {
      setPluginIntegrationConfig: (
        parent: unknown,
        args: { input: { integrationId: string; credential: unknown } },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Mutation.setPluginIntegrationConfig(
        {},
        { input: { integrationId: 'fake', credential: {} } },
        ctx,
      ),
    ).rejects.toThrow(
      'User does not have permission to update integration configs',
    );
    expect(setConfigByIntegrationId).not.toHaveBeenCalled();
  });
});
