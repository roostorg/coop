import { buildAuthorFeedPostSubmission } from './transformers.js';

describe('buildAuthorFeedPostSubmission', () => {
  const did = 'did:plc:abc123';
  const uri = `at://${did}/app.bsky.feed.post/3k4abc`;

  const sampleView = {
    post: {
      uri,
      cid: 'bafyreitestcid',
      author: { did, handle: 'alice.bsky.social' },
      indexedAt: '2026-07-13T00:00:00.000Z',
      record: {
        $type: 'app.bsky.feed.post' as const,
        text: 'hello from the author feed',
        createdAt: '2026-07-12T23:59:00.000Z',
        langs: ['en'],
      },
    },
  };

  test('maps a getAuthorFeed post view into an ATproto-post submission', () => {
    const submission = buildAuthorFeedPostSubmission(sampleView);
    expect(submission).not.toBeNull();
    const data = submission!.data as {
      text: string;
      cid: string;
      atUri: string;
      rkey: string;
      langs: string[];
      authorDid: { id: string; typeId: string };
    };

    expect((submission as { typeId: string }).typeId).toBe('ATproto-post');
    // Item id is the post's at:// uri
    expect(submission!.id).toBe(uri);
    expect(data.atUri).toBe(uri);
    expect(data.rkey).toBe('3k4abc');
    expect(data.text).toBe('hello from the author feed');
    expect(data.cid).toBe('bafyreitestcid');
    expect(data.langs).toEqual(['en']);
    // Author/creator links to the ATproto-account for the post's DID
    expect(data.authorDid).toEqual({ id: did, typeId: 'ATproto-account' });
  });

  test('returns null when the post view is missing required fields', () => {
    expect(buildAuthorFeedPostSubmission({ post: { uri } })).toBeNull();
    expect(buildAuthorFeedPostSubmission({})).toBeNull();
  });
});
