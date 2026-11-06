import { getScalarType, ScalarTypes } from '@roostorg/coop-types';
import _ from 'lodash';

import { type Dependencies } from '../../iocContainer/index.js';
import { isClipEmbedding } from '../../services/hmaService/index.js';
import { type ItemType } from '../../services/moderationConfigService/index.js';
import { withRetries } from '../../utils/misc.js';

type HashService = Pick<
  Dependencies['HMAHashBankService'],
  | 'listBanks'
  | 'hashContentFromUrl'
  | 'checkImageMatchWithDetails'
  | 'isClipEnabled'
  | 'findClosestClipMatch'
>;

type ImageValue = string | { url: string; [key: string]: unknown };

/**
 * Computes HMA hashes for every Image- (or Media-) typed field in the item's schema
 * (singular or array, whatever the field is named) and writes them back onto
 * `data`, in the same shape the field already had, so that signals like
 * IMAGE_SIMILARITY_MATCH can read `hashes` and `matchedBanks` from the values.
 *
 * When HMA also returns a CLIP embedding (`clip_float`) and the deployment has
 * CLIP enabled, it is stored under `embeddings` instead. It is kept out of
 * `hashes` on purpose: everything in `hashes` is forwarded to NCMEC as a file
 * hash. It is dropped whenever CLIP is not enabled, so it can never end up in
 * `hashes` or in storage by accident.
 *
 * NB: This mutates `data`.
 */
export async function addHashesToImageFields({
  itemType,
  data,
  orgId,
  HMAHashBankService,
}: {
  itemType: Pick<ItemType, 'schema'>;
  data: { [key: string]: unknown };
  orgId: string;
  HMAHashBankService: HashService;
}) {
  // Only HMA may set embeddings, so drop any the client sent up front.
  removeClientEmbeddings(itemType, data);

  const imageFields = itemType.schema.filter(
    (field) =>
      isHashableScalarType(getScalarType(field)) &&
      hasImageValues(field.type, data[field.name]),
  );
  if (imageFields.length === 0) {
    return;
  }

  try {
    // Get all hash banks for this org once. Banks only add `matchedBanks`
    // metadata, so failing to list them must not stop us hashing the images.
    const allBanks = await HMAHashBankService.listBanks(orgId).catch(() => []);
    const allBankNames = allBanks.map((bank) => bank.hma_name);

    const hashImage = async (image: ImageValue) => {
      // MEDIA fields can also hold video/audio, which we return unchanged.
      // A null mediaType means the kind couldn't be inferred from the URL's
      // extension, so we hash it and let HMA detect the content type.
      if (
        typeof image === 'object' &&
        'mediaType' in image &&
        image.mediaType != null &&
        image.mediaType !== ScalarTypes.IMAGE
      ) {
        return image;
      }
      const url = typeof image === 'string' ? image : image.url;
      // Preserve any fields the coercion step already populated on the media
      // object, rather than rebuilding a fresh object that drops them.
      const coercedFields = typeof image === 'string' ? {} : image;
      if (typeof url !== 'string' || !url) {
        return null;
      }

      let hmaHashes: Record<string, string>;
      try {
        const hmaHashWithRetries = await withRetries(
          {
            maxRetries: 5,
            initialTimeMsBetweenRetries: 5,
            maxTimeMsBetweenRetries: 500,
            jitter: true,
          },
          async () => HMAHashBankService.hashContentFromUrl(url),
        );
        hmaHashes = await hmaHashWithRetries();
      } catch (e) {
        return { ...coercedFields, url, hashes: {} };
      }
      const { clip_float: clipFloat, ...hashes } = hmaHashes;
      const embeddings =
        HMAHashBankService.isClipEnabled() && isClipEmbedding(clipFloat)
          ? { clip_float: clipFloat }
          : undefined;

      // Matching is best-effort: signals re-check the hashes against banks
      // themselves, so a failed lookup must not discard the hashes we have.
      const matchedBankNames: string[] = [];
      try {
        const lookups: Promise<{ matchedBanks: string[] }>[] = Object.entries(
          hashes,
        ).map(async ([signalType, hash]) =>
          HMAHashBankService.checkImageMatchWithDetails(
            allBankNames,
            signalType,
            hash,
          ),
        );
        if (embeddings) {
          // Held to the same 0.10 cutoff as the CLIP signal, so matchedBanks
          // never lists a bank that the signal scores 0.
          lookups.push(
            HMAHashBankService.findClosestClipMatch(
              allBankNames,
              embeddings.clip_float,
            ),
          );
        }
        if (lookups.length > 0 && allBankNames.length > 0) {
          const matchResults = await Promise.all(lookups);

          const allMatchedHmaBanks = new Set<string>();
          matchResults.forEach((result) => {
            result.matchedBanks.forEach((bank) => allMatchedHmaBanks.add(bank));
          });

          // Map HMA bank names to user-friendly names
          allMatchedHmaBanks.forEach((hmaName) => {
            const bank = allBanks.find((b) => b.hma_name === hmaName);
            if (bank) {
              matchedBankNames.push(bank.name);
            }
          });
        }
      } catch (e) {
        matchedBankNames.length = 0;
      }

      return {
        ...coercedFields,
        url,
        hashes,
        ...(embeddings ? { embeddings } : {}),
        matchedBanks:
          matchedBankNames.length > 0 ? matchedBankNames : undefined,
      };
    };

    for (const field of imageFields) {
      const value = data[field.name];
      if (field.type === 'ARRAY') {
        data[field.name] = await Promise.all(
          (value as ImageValue[]).map(hashImage),
        );
      } else if (field.type === 'MAP') {
        const entries = Object.entries(value as Record<string, ImageValue>);
        const hashed = await Promise.all(
          entries.map(async ([, it]) => hashImage(it)),
        );
        data[field.name] = Object.fromEntries(
          entries.map(([key], i) => [key, hashed[i]]),
        );
      } else {
        const hashed = await hashImage(value as ImageValue);
        if (hashed) {
          data[field.name] = hashed;
        }
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get HMA hashes for images:', error);
  }
}

function isHashableScalarType(scalarType: string) {
  return scalarType === ScalarTypes.IMAGE || scalarType === ScalarTypes.MEDIA;
}

/** Whether a field's value holds at least one image to hash. */
function hasImageValues(fieldType: string, value: unknown) {
  if (value == null) {
    return false;
  }
  if (fieldType === 'ARRAY') {
    return Array.isArray(value) && value.length > 0;
  }
  if (fieldType === 'MAP') {
    return typeof value === 'object' && Object.keys(value).length > 0;
  }
  return true;
}

/**
 * Drops client-supplied `embeddings` from the image values of `data`. For items
 * that are not hashed (a report's thread and additional items), this is the
 * only thing standing between a client and a forged CLIP embedding.
 *
 * NB: This mutates `data`.
 */
export function removeClientEmbeddings(
  itemType: Pick<ItemType, 'schema'>,
  data: { [key: string]: unknown },
) {
  const strip = (value: unknown) =>
    typeof value === 'object' && value !== null && 'embeddings' in value
      ? _.omit(value, 'embeddings')
      : value;
  for (const field of itemType.schema) {
    const value = data[field.name];
    if (
      !isHashableScalarType(getScalarType(field)) ||
      !hasImageValues(field.type, value)
    ) {
      continue;
    }
    data[field.name] =
      field.type === 'ARRAY'
        ? (value as unknown[]).map(strip)
        : field.type === 'MAP'
          ? _.mapValues(value as Record<string, unknown>, strip)
          : strip(value);
  }
}
