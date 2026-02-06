// Should be human-readable
export enum CoopInput {
  ALL_TEXT = 'All text',
  ANY_IMAGE = 'Any image',
  ANY_GEOHASH = 'Any geohash',
  ANY_VIDEO = 'Any video',
  AUTHOR_USER = 'Content author (user)',
  POLICY_ID = 'Relevant Policy',
  SOURCE = 'Creation Source',
}

export const CoopInputEnumInverted = Object.fromEntries(
  Object.entries(CoopInput).map(([key, value]) => [value, key]),
) as { [key: string]: string | undefined };
