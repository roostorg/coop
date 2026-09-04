import { GQLScalarType } from '../../../graphql/generated';
import { nextFieldIndex } from './ItemTypeForm';
import type { FieldState } from './ItemTypeFormCustomField';

function field(index: number): FieldState {
  return {
    index,
    name: `field${index}`,
    type: GQLScalarType.String,
    required: false,
    hidden: false,
  };
}

describe('nextFieldIndex', () => {
  it('is 0 for an empty field list', () => {
    expect(nextFieldIndex([])).toBe(0);
  });

  it('is length when indices are contiguous from 0', () => {
    expect(nextFieldIndex([field(0), field(1), field(2)])).toBe(3);
  });

  it('does not reuse an existing index after a middle field was removed', () => {
    // Simulates: add 3 (0,1,2) -> delete the middle -> add again.
    // `customFields.length` would have returned 2, colliding with field(2).
    const afterDelete = [field(0), field(2)];
    const next = nextFieldIndex(afterDelete);

    expect(next).toBe(3);
    expect(afterDelete.map((f) => f.index)).not.toContain(next);
  });
});
