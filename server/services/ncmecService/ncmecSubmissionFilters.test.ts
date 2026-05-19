import { filterDecisionsToFailedSubmissions } from './ncmecSubmissionFilters.js';

describe('filterDecisionsToFailedSubmissions', () => {
  it('returns all decisions when no submissions are successful', () => {
    const decisions = [
      { userId: 'u1', userItemTypeId: 't1', payload: 'a' },
      { userId: 'u2', userItemTypeId: 't1', payload: 'b' },
    ];
    expect(filterDecisionsToFailedSubmissions(decisions, [])).toEqual(
      decisions,
    );
  });

  it('removes decisions that match a successful (userId, userItemTypeId) pair', () => {
    const decisions = [
      { userId: 'u1', userItemTypeId: 't1', payload: 'a' },
      { userId: 'u2', userItemTypeId: 't1', payload: 'b' },
      { userId: 'u3', userItemTypeId: 't2', payload: 'c' },
    ];
    const successful = [{ userId: 'u2', userItemTypeId: 't1' }];
    expect(filterDecisionsToFailedSubmissions(decisions, successful)).toEqual([
      { userId: 'u1', userItemTypeId: 't1', payload: 'a' },
      { userId: 'u3', userItemTypeId: 't2', payload: 'c' },
    ]);
  });

  it('does NOT match across different userItemTypeIds when userId is the same', () => {
    // Same user id under a different type identifier counts as a different
    // submission and should remain in the failed list.
    const decisions = [
      { userId: 'u1', userItemTypeId: 't1', payload: 'a' },
      { userId: 'u1', userItemTypeId: 't2', payload: 'b' },
    ];
    const successful = [{ userId: 'u1', userItemTypeId: 't1' }];
    expect(filterDecisionsToFailedSubmissions(decisions, successful)).toEqual([
      { userId: 'u1', userItemTypeId: 't2', payload: 'b' },
    ]);
  });

  it('returns empty when every decision has a corresponding successful submission', () => {
    const decisions = [
      { userId: 'u1', userItemTypeId: 't1' },
      { userId: 'u2', userItemTypeId: 't1' },
    ];
    const successful = [
      { userId: 'u1', userItemTypeId: 't1' },
      { userId: 'u2', userItemTypeId: 't1' },
    ];
    expect(filterDecisionsToFailedSubmissions(decisions, successful)).toEqual(
      [],
    );
  });

  it('does not collide when userId+userItemTypeId concatenation is ambiguous', () => {
    // Without a delimiter, ('a', 'bc') and ('ab', 'c') would collide. The
    // helper uses NUL as a delimiter, so these stay distinct.
    const decisions = [
      { userId: 'a', userItemTypeId: 'bc', payload: '1' },
      { userId: 'ab', userItemTypeId: 'c', payload: '2' },
    ];
    const successful = [{ userId: 'a', userItemTypeId: 'bc' }];
    expect(filterDecisionsToFailedSubmissions(decisions, successful)).toEqual([
      { userId: 'ab', userItemTypeId: 'c', payload: '2' },
    ]);
  });
});
