import { getPgErrorDetails, isUniqueViolationError } from './kysely.js';

describe('getPgErrorDetails', () => {
  const cause = {
    originalCode: '23505',
    originalMessage:
      'duplicate key value violates unique constraint "routing_rules_org_id_name_key"',
    kind: 'UniqueConstraintViolation',
    constraint: { index: 'routing_rules_org_id_name_key' },
    table: 'routing_rules',
  };
  const expected = {
    code: '23505',
    constraint: 'routing_rules_org_id_name_key',
    table: 'routing_rules',
  };

  test('reads a Prisma query error', () => {
    const error = Object.assign(new Error('P2002'), {
      code: 'P2002',
      meta: { driverAdapterError: { cause } },
    });
    expect(getPgErrorDetails(error)).toEqual(expected);
    expect(isUniqueViolationError(error)).toBe(true);
  });

  // A DEFERRABLE constraint fails at COMMIT, which Prisma rethrows as the
  // bare driver adapter error.
  test('reads a bare driver adapter error from COMMIT', () => {
    const error = Object.assign(new Error('UniqueConstraintViolation'), {
      name: 'DriverAdapterError',
      cause,
    });
    expect(getPgErrorDetails(error)).toEqual(expected);
    expect(isUniqueViolationError(error)).toBe(true);
  });

  test('reads a raw pg error', () => {
    const error = Object.assign(new Error('duplicate key'), expected);
    expect(getPgErrorDetails(error)).toEqual(expected);
  });
});
