import { typeDefs } from './moderationActivity.js';

describe('moderationActivity schema', () => {
  it('exposes both queries', () => {
    expect(typeDefs).toContain('recentModerationActivity(');
    expect(typeDefs).toContain('manualActionItems(');
  });

  it('models rows as an interface so the client discriminates on __typename', () => {
    expect(typeDefs).toContain('interface ModerationActivityRow');
    expect(typeDefs).toContain(
      'type ReviewJobDecisionRow implements ModerationActivityRow',
    );
    expect(typeDefs).toContain(
      'type ManualActionRow implements ModerationActivityRow',
    );
  });

  it('caps page sizes', () => {
    expect(typeDefs).toContain('limit: Int');
  });

  it('uses the opaque Cursor scalar rather than a bare string', () => {
    expect(typeDefs).toContain('cursor: Cursor');
    expect(typeDefs).toContain('nextCursor: Cursor');
  });

  it('does not expose offset on manualActionItems', () => {
    const inputBlock = typeDefs.slice(
      typeDefs.indexOf('input ManualActionItemsInput'),
      typeDefs.indexOf('type ManualActionItem'),
    );
    expect(inputBlock).not.toContain('offset');
  });
});
