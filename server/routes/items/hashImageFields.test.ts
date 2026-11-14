import { vi } from 'vitest';

import { type ItemType } from '../../services/moderationConfigService/index.js';
import {
  addHashesToImageFields,
  removeClientEmbeddings,
} from './hashImageFields.js';

const schema = [
  { name: 'text', type: 'STRING', required: false, container: null },
  { name: 'images', type: 'IMAGE', required: false, container: null },
  {
    name: 'profilePic',
    type: 'ARRAY',
    required: false,
    container: {
      containerType: 'ARRAY',
      keyScalarType: 'NUMBER',
      valueScalarType: 'IMAGE',
    },
  },
  { name: 'cover', type: 'IMAGE', required: false, container: null },
] as unknown as ItemType['schema'];

const imageArray = {
  containerType: 'ARRAY',
  keyScalarType: 'NUMBER',
  valueScalarType: 'IMAGE',
};

const makeSchema = (fields: object[]) =>
  fields.map((it) => ({
    required: false,
    container: null,
    ...it,
  })) as unknown as ItemType['schema'];

const HMAHashBankService = {
  listBanks: vi.fn(),
  hashContentFromUrl: vi.fn(),
  checkImageMatchWithDetails: vi.fn(),
  isClipEnabled: vi.fn(),
  findClosestClipMatch: vi.fn(),
};

describe('addHashesToImageFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HMAHashBankService.listBanks.mockResolvedValue([
      { hma_name: 'hma_bank', name: 'Bank' },
    ]);
    HMAHashBankService.hashContentFromUrl.mockResolvedValue({ pdq: 'abc' });
    HMAHashBankService.isClipEnabled.mockReturnValue(false);
    HMAHashBankService.findClosestClipMatch.mockResolvedValue({
      matchedBanks: ['hma_bank'],
      closestDistance: 0.03,
    });
    HMAHashBankService.checkImageMatchWithDetails.mockResolvedValue({
      matchedBanks: ['hma_bank'],
    });
  });

  const run = async (
    data: { [key: string]: unknown },
    itemSchema: ItemType['schema'] = schema,
  ) => {
    await addHashesToImageFields({
      itemType: { schema: itemSchema },
      data,
      orgId: 'org',
      HMAHashBankService,
    });
    return data;
  };

  it('hashes an array Image field not named `images`', async () => {
    const data = await run({ profilePic: [{ url: 'https://x.test/a.png' }] });
    expect(data.profilePic).toEqual([
      {
        url: 'https://x.test/a.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
    ]);
  });

  it('hashes a singular Image field, keeping it a single object', async () => {
    const data = await run({ images: { url: 'https://x.test/a.png' } });
    expect(data.images).toEqual({
      url: 'https://x.test/a.png',
      hashes: { pdq: 'abc' },
      matchedBanks: ['Bank'],
    });
  });

  it('hashes an array Image field named `images`', async () => {
    const data = await run(
      {
        images: [
          { url: 'https://x.test/a.png' },
          { url: 'https://x.test/b.png' },
        ],
      },
      makeSchema([{ name: 'images', type: 'ARRAY', container: imageArray }]),
    );
    expect(data.images).toEqual([
      {
        url: 'https://x.test/a.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
      {
        url: 'https://x.test/b.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
    ]);
  });

  it('hashes a singular Image field not named `images`', async () => {
    const data = await run({ cover: { url: 'https://x.test/c.png' } });
    expect(data.cover).toEqual({
      url: 'https://x.test/c.png',
      hashes: { pdq: 'abc' },
      matchedBanks: ['Bank'],
    });
  });

  it.each([
    ['a STRING', { name: 'images', type: 'STRING' }, 'https://x.test/a.png'],
    [
      'an array of STRING',
      {
        name: 'images',
        type: 'ARRAY',
        container: { ...imageArray, valueScalarType: 'STRING' },
      },
      ['https://x.test/a.png'],
    ],
  ])(
    'does not hash a field named `images` that is %s',
    async (_, field, value) => {
      const data = await run({ images: value }, makeSchema([field]));
      expect(data.images).toEqual(value);
      expect(HMAHashBankService.hashContentFromUrl).not.toHaveBeenCalled();
    },
  );

  it('keeps the image with empty hashes when hashing fails', async () => {
    HMAHashBankService.hashContentFromUrl.mockRejectedValue(new Error('boom'));
    const data = await run({ cover: { url: 'https://x.test/c.png' } });
    expect(data.cover).toEqual({ url: 'https://x.test/c.png', hashes: {} });
  });

  it('leaves matchedBanks undefined when no bank matches', async () => {
    HMAHashBankService.checkImageMatchWithDetails.mockResolvedValue({
      matchedBanks: [],
    });
    const data = await run({ cover: { url: 'https://x.test/c.png' } });
    expect(data.cover).toEqual({
      url: 'https://x.test/c.png',
      hashes: { pdq: 'abc' },
      matchedBanks: undefined,
    });
  });

  it('keeps the computed hashes when the bank lookup fails', async () => {
    HMAHashBankService.checkImageMatchWithDetails.mockRejectedValue(
      new Error('lookup down'),
    );
    const data = await run({ cover: { url: 'https://x.test/c.png' } });
    expect(data.cover).toEqual({
      url: 'https://x.test/c.png',
      hashes: { pdq: 'abc' },
      matchedBanks: undefined,
    });
  });

  it('skips the bank lookup entirely when image containers are empty', async () => {
    await run({ profilePic: [] });
    expect(HMAHashBankService.listBanks).not.toHaveBeenCalled();
  });

  it('hashes every value of a MAP-of-Image field', async () => {
    const data = await run(
      {
        gallery: {
          a: { url: 'https://x.test/a.png' },
          b: { url: 'https://x.test/b.png' },
        },
      },
      makeSchema([
        {
          name: 'gallery',
          type: 'MAP',
          container: {
            containerType: 'MAP',
            keyScalarType: 'STRING',
            valueScalarType: 'IMAGE',
          },
        },
      ]),
    );
    expect(data.gallery).toEqual({
      a: {
        url: 'https://x.test/a.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
      b: {
        url: 'https://x.test/b.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
    });
  });

  it('hashes images in a MEDIA array and leaves videos unchanged', async () => {
    const video = { url: 'https://x.test/v.mp4', mediaType: 'VIDEO' };
    const data = await run(
      {
        attachments: [
          { url: 'https://x.test/a.png', mediaType: 'IMAGE' },
          video,
        ],
      },
      makeSchema([
        {
          name: 'attachments',
          type: 'ARRAY',
          container: { ...imageArray, valueScalarType: 'MEDIA' },
        },
      ]),
    );
    expect(data.attachments).toEqual([
      {
        url: 'https://x.test/a.png',
        mediaType: 'IMAGE',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      },
      video,
    ]);
    expect(HMAHashBankService.hashContentFromUrl).toHaveBeenCalledTimes(1);
  });

  it('hashes a singular MEDIA field holding an image', async () => {
    const data = await run(
      { attachment: { url: 'https://x.test/a.png', mediaType: 'IMAGE' } },
      makeSchema([{ name: 'attachment', type: 'MEDIA' }]),
    );
    expect(data.attachment).toMatchObject({
      mediaType: 'IMAGE',
      hashes: { pdq: 'abc' },
    });
  });

  it('hashes a MEDIA value whose mediaType could not be detected', async () => {
    const data = await run(
      { attachment: { url: 'https://x.test/no-extension', mediaType: null } },
      makeSchema([{ name: 'attachment', type: 'MEDIA' }]),
    );
    expect(data.attachment).toMatchObject({
      mediaType: null,
      hashes: { pdq: 'abc' },
    });
  });

  it('still hashes images when listing banks fails', async () => {
    HMAHashBankService.listBanks.mockRejectedValue(new Error('db down'));
    const data = await run({ cover: { url: 'https://x.test/c.png' } });
    expect(data.cover).toEqual({
      url: 'https://x.test/c.png',
      hashes: { pdq: 'abc' },
      matchedBanks: undefined,
    });
  });

  it('hashes every Image field and leaves other fields alone', async () => {
    const data = await run({
      text: 'hi',
      cover: { url: 'https://x.test/c.png' },
      profilePic: [{ url: 'https://x.test/a.png' }],
    });
    expect(data.text).toBe('hi');
    expect(data.cover).toMatchObject({ hashes: { pdq: 'abc' } });
    expect(HMAHashBankService.hashContentFromUrl).toHaveBeenCalledTimes(2);
  });
  describe('CLIP embeddings', () => {
    const CLIP = 'ab'.repeat(2048);

    beforeEach(() => {
      HMAHashBankService.isClipEnabled.mockReturnValue(true);
      HMAHashBankService.hashContentFromUrl.mockResolvedValue({
        pdq: 'abc',
        clip_float: CLIP,
      });
    });

    it('stores clip_float under embeddings, never in hashes, which are forwarded to NCMEC', async () => {
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(data.cover).toEqual({
        url: 'https://x.test/c.png',
        hashes: { pdq: 'abc' },
        embeddings: { clip_float: CLIP },
        matchedBanks: ['Bank'],
      });
    });

    it('drops clip_float from hashes even when CLIP is not enabled, and stores nothing', async () => {
      HMAHashBankService.isClipEnabled.mockReturnValue(false);
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(data.cover).toEqual({
        url: 'https://x.test/c.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      });
    });

    it('drops a clip_float that is not an embedding', async () => {
      HMAHashBankService.hashContentFromUrl.mockResolvedValue({
        pdq: 'abc',
        clip_float: 'not hex!',
      });
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(data.cover).toEqual({
        url: 'https://x.test/c.png',
        hashes: { pdq: 'abc' },
        matchedBanks: ['Bank'],
      });
    });

    it('checks the embedding against the banks with the 0.10 cutoff, so matchedBanks can list CLIP matches', async () => {
      HMAHashBankService.checkImageMatchWithDetails.mockResolvedValue({
        matchedBanks: [],
      });
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(HMAHashBankService.findClosestClipMatch).toHaveBeenCalledWith(
        ['hma_bank'],
        CLIP,
      );
      expect(
        HMAHashBankService.checkImageMatchWithDetails,
      ).toHaveBeenCalledWith(['hma_bank'], 'pdq', 'abc');
      expect(
        HMAHashBankService.checkImageMatchWithDetails,
      ).not.toHaveBeenCalledWith(expect.anything(), 'clip_float', CLIP);
      expect(data.cover).toMatchObject({ matchedBanks: ['Bank'] });
    });

    it('keeps the matches the other lookups found when the CLIP lookup fails', async () => {
      HMAHashBankService.findClosestClipMatch.mockRejectedValue(
        new Error('HMA down'),
      );
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(data.cover).toMatchObject({ matchedBanks: ['Bank'] });
    });

    it('looks nothing up for an org without banks, but still stores the embedding', async () => {
      HMAHashBankService.listBanks.mockResolvedValue([]);
      const data = await run({ cover: { url: 'https://x.test/c.png' } });
      expect(
        HMAHashBankService.checkImageMatchWithDetails,
      ).not.toHaveBeenCalled();
      expect(HMAHashBankService.findClosestClipMatch).not.toHaveBeenCalled();
      expect(data.cover).toEqual({
        url: 'https://x.test/c.png',
        hashes: { pdq: 'abc' },
        embeddings: { clip_float: CLIP },
      });
    });

    it('does not look the embedding up when CLIP is not enabled', async () => {
      HMAHashBankService.isClipEnabled.mockReturnValue(false);
      await run({ cover: { url: 'https://x.test/c.png' } });
      expect(HMAHashBankService.findClosestClipMatch).not.toHaveBeenCalled();
    });

    it('ignores an embedding supplied by the client, whether or not hashing works', async () => {
      const forged = { clip_float: 'forged' };
      HMAHashBankService.isClipEnabled.mockReturnValue(false);
      const withoutClip = await run({
        cover: { url: 'https://x.test/c.png', embeddings: forged },
      });
      expect(withoutClip.cover).not.toHaveProperty('embeddings');

      HMAHashBankService.hashContentFromUrl.mockRejectedValue(
        new Error('HMA down'),
      );
      const whenHashingFails = await run({
        cover: { url: 'https://x.test/c.png', embeddings: forged },
      });
      expect(whenHashingFails.cover).not.toHaveProperty('embeddings');
    });

    it('ignores an embedding supplied on a video, which is not hashed', async () => {
      const data = await run(
        {
          attachment: {
            url: 'https://x.test/v.mp4',
            mediaType: 'VIDEO',
            embeddings: { clip_float: 'forged' },
          },
        },
        makeSchema([{ name: 'attachment', type: 'MEDIA' }]),
      );
      expect(data.attachment).toEqual({
        url: 'https://x.test/v.mp4',
        mediaType: 'VIDEO',
      });
    });
  });
});

describe('removeClientEmbeddings', () => {
  it('drops embeddings from single, array and map image values and nothing else', () => {
    const data: Record<string, unknown> = {
      text: 'embeddings stay in text fields',
      cover: { url: 'https://x.test/c.png', embeddings: { clip_float: 'ab' } },
      profilePic: [
        { url: 'https://x.test/1.png', embeddings: { clip_float: 'ab' } },
        'https://x.test/2.png',
      ],
      byName: {
        a: { url: 'https://x.test/3.png', embeddings: { clip_float: 'ab' } },
      },
    };
    const mapSchema = [
      ...schema,
      {
        name: 'byName',
        type: 'MAP',
        required: false,
        container: {
          containerType: 'MAP',
          keyScalarType: 'STRING',
          valueScalarType: 'IMAGE',
        },
      },
    ] as unknown as ItemType['schema'];

    removeClientEmbeddings({ schema: mapSchema }, data);

    expect(data).toEqual({
      text: 'embeddings stay in text fields',
      cover: { url: 'https://x.test/c.png' },
      profilePic: [{ url: 'https://x.test/1.png' }, 'https://x.test/2.png'],
      byName: { a: { url: 'https://x.test/3.png' } },
    });
  });
});
