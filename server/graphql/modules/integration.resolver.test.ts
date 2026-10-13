import {
  assertInputType,
  buildASTSchema,
  coerceInputValue,
  Kind,
  parse,
} from 'graphql';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers, typeDefs } from './integration.js';

describe('Zentropi integration input', () => {
  // Use the actual SDL so this catches input nullability regressions, not just
  // resolver behavior after GraphQL has already accepted the request.
  const document = parse(typeDefs);
  const schema = buildASTSchema({
    ...document,
    definitions: document.definitions.filter(
      (definition) =>
        definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
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
