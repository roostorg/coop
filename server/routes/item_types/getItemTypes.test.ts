import { type Dependencies } from '../../iocContainer/index.js';
import getItemTypes from './getItemTypes.js';

test('omits organization IDs without dropping kind-specific item metadata', async () => {
  const itemTypes = ['CONTENT', 'THREAD', 'USER'].map((kind) => ({
    id: kind,
    orgId: 'private-org',
    kind,
    name: kind,
    schema: [],
    schemaFieldRoles: {},
    ...(kind === 'USER' ? { isDefaultUserType: true } : {}),
  }));
  const read = jest.fn().mockResolvedValue(itemTypes);
  const handler = getItemTypes({
    ModerationConfigService: { getItemTypes: read },
  } as unknown as Dependencies);
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnValue({ json }) };
  await handler(
    { orgId: 'private-org' } as unknown as Parameters<typeof handler>[0],
    response as unknown as Parameters<typeof handler>[1],
    jest.fn(),
  );
  expect(read).toHaveBeenCalledWith({
    orgId: 'private-org',
    directives: { maxAge: 0 },
  });
  expect(json).toHaveBeenCalledWith({
    itemTypes: itemTypes.map(({ orgId: _orgId, ...itemType }) => itemType),
  });
  expect(itemTypes.every((itemType) => itemType.orgId === 'private-org')).toBe(
    true,
  );
});
