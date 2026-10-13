import { getScalarType, ScalarTypes } from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import { type ItemType } from '../../services/moderationConfigService/index.js';
import { withRetries } from '../../utils/misc.js';

type HashService = Pick<
  Dependencies['HMAHashBankService'],
  'listBanks' | 'hashContentFromUrl' | 'checkImageMatchWithDetails'
>;

type ImageValue = string | { url: string; [key: string]: unknown };

/**
 * Computes HMA hashes for every Image- (or Media-) typed field in the item's schema
 * (singular or array, whatever the field is named) and writes them back onto
 * `data`, in the same shape the field already had, so that signals like
 * IMAGE_SIMILARITY_MATCH can read `hashes` and `matchedBanks` from the values.
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

      let hashes: Record<string, string>;
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
        hashes = await hmaHashWithRetries();
      } catch (e) {
        return { ...coercedFields, url, hashes: {} };
      }

      // Matching is best-effort: signals re-check the hashes against banks
      // themselves, so a failed lookup must not discard the hashes we have.
      const matchedBankNames: string[] = [];
      try {
        if (Object.keys(hashes).length > 0 && allBankNames.length > 0) {
          const matchResults = await Promise.all(
            Object.entries(hashes).map(async ([signalType, hash]) =>
              HMAHashBankService.checkImageMatchWithDetails(
                allBankNames,
                signalType,
                hash,
              ),
            ),
          );

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
