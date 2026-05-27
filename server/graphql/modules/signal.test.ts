import { type SignalSubcategory } from '@roostorg/coop-types';

import {
  BuiltInExternalSignalType,
  BuiltInThirdPartySignalType,
} from '../../services/signalsService/index.js';
import { flattenSubcategories, typeDefs } from './signal.js';

describe('flattenSubcategories', () => {
  it('Should flatten Hive categories correctly', () => {
    const testHiveSubcategories = [
      {
        id: 'Hate Groups',
        label: 'Hate Groups',
        children: [
          {
            id: 'yes_nazi' as const,
            label: 'Nazi Content',
            description:
              'Nazi symbols such as swastikas, images of Hitler, SS insignias, etc.',
            children: [],
          },
          {
            id: 'yes_terrorist' as const,
            label: 'Terrorist Content',
            description:
              'Flags and symbols of known terrorist groups like ISIS and Al Qaeda. Does not flag photos of known terrorists.',
            children: [],
          },
          {
            id: 'yes_kkk' as const,
            label: 'White Supremacist Content',
            description:
              'White supremacist symbols, e.g. KKK hoods and robes, burning crosses',
            children: [],
          },
        ],
      },
      {
        id: 'Rude Gestures',
        label: 'Rude Gestures',
        children: [
          {
            id: 'yes_middle_finger' as const,
            label: 'Middle Finger',
            description:
              'At least one person giving the middle finger intentionally (as an insult)',
            children: [],
          },
        ],
      },
    ] satisfies SignalSubcategory[];

    const expectedFlattenedSubcategories = [
      {
        id: 'Hate Groups',
        label: 'Hate Groups',
        childrenIds: ['yes_nazi', 'yes_terrorist', 'yes_kkk'],
      },
      {
        id: 'yes_nazi' as const,
        label: 'Nazi Content',
        description:
          'Nazi symbols such as swastikas, images of Hitler, SS insignias, etc.',
        childrenIds: [],
      },
      {
        id: 'yes_terrorist' as const,
        label: 'Terrorist Content',
        description:
          'Flags and symbols of known terrorist groups like ISIS and Al Qaeda. Does not flag photos of known terrorists.',
        childrenIds: [],
      },
      {
        id: 'yes_kkk' as const,
        label: 'White Supremacist Content',
        description:
          'White supremacist symbols, e.g. KKK hoods and robes, burning crosses',
        childrenIds: [],
      },
      {
        id: 'Rude Gestures',
        label: 'Rude Gestures',
        childrenIds: ['yes_middle_finger'],
      },
      {
        id: 'yes_middle_finger' as const,
        label: 'Middle Finger',
        description:
          'At least one person giving the middle finger intentionally (as an insult)',
        childrenIds: [],
      },
    ];

    expect(flattenSubcategories(testHiveSubcategories)).toEqual(
      expectedFlattenedSubcategories,
    );
  });
  test('Should flatten Rekognition subcategories correctly', () => {
    const testRekognitionSubcategories = [
      {
        id: 'Nudity and Sexual Content',
        label: 'Nudity and Sexual Content',
        children: [
          { id: 'Nudity' as const, label: 'Nudity', children: [] },
          {
            id: 'Graphic Male Nudity' as const,
            label: 'Graphic Male Nudity',
            children: [],
          },
          {
            id: 'Graphic Female Nudity' as const,
            label: 'Graphic Female Nudity',
            children: [],
          },
          {
            id: 'Sexual Activity' as const,
            label: 'Sexual Activity',
            children: [],
          },
          {
            id: 'Illustrated Explicit Nudity' as const,
            label: 'Illustrated Explicit Nudity',
            children: [],
          },
          { id: 'Adult Toys' as const, label: 'Adult Toys', children: [] },
        ],
      },
    ] as SignalSubcategory[];

    const expectedFlattenedSubcategories = [
      {
        id: 'Nudity and Sexual Content',
        label: 'Nudity and Sexual Content',
        childrenIds: [
          'Nudity',
          'Graphic Male Nudity',
          'Graphic Female Nudity',
          'Sexual Activity',
          'Illustrated Explicit Nudity',
          'Adult Toys',
        ],
      },
      { id: 'Nudity' as const, label: 'Nudity', childrenIds: [] },
      {
        id: 'Graphic Male Nudity' as const,
        label: 'Graphic Male Nudity',
        childrenIds: [],
      },
      {
        id: 'Graphic Female Nudity' as const,
        label: 'Graphic Female Nudity',
        childrenIds: [],
      },
      {
        id: 'Sexual Activity' as const,
        label: 'Sexual Activity',
        childrenIds: [],
      },
      {
        id: 'Illustrated Explicit Nudity' as const,
        label: 'Illustrated Explicit Nudity',
        childrenIds: [],
      },
      { id: 'Adult Toys' as const, label: 'Adult Toys', childrenIds: [] },
    ];

    expect(flattenSubcategories(testRekognitionSubcategories)).toEqual(
      expectedFlattenedSubcategories,
    );
  });
});

/**
 * The GraphQL `SignalType` enum is hand-maintained inside the SDL string in
 * this module, separate from the canonical TS `SignalType` enum-like objects
 * in `services/signalsService/types/SignalType.ts`. Adding a new built-in
 * signal type to the TS side compiles cleanly but silently leaves the GraphQL
 * enum stale — and a stale GraphQL enum means the new signal is invisible to
 * the dashboard.
 *
 * Every `BuiltInExternalSignalType` and `BuiltInThirdPartySignalType` value
 * must round-trip through the GraphQL enum. We don't enforce the converse —
 * the GraphQL enum may legitimately include `CUSTOM` (user-created) — only
 * that every built-in is exposed.
 */
describe('GraphQL SignalType enum coverage', () => {
  function extractGraphQlEnumValues(
    sdl: string,
    enumName: string,
  ): Set<string> {
    const match = sdl.match(
      new RegExp(`enum\\s+${enumName}\\s*\\{([^}]+)\\}`, 'm'),
    );
    if (!match) {
      throw new Error(`Could not find enum ${enumName} in typeDefs`);
    }
    return new Set(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')),
    );
  }

  const graphQlSignalTypes = extractGraphQlEnumValues(typeDefs, 'SignalType');

  test.each(Object.keys(BuiltInExternalSignalType))(
    'GraphQL SignalType enum includes BuiltInExternalSignalType: %s',
    (name) => {
      expect(graphQlSignalTypes.has(name)).toBe(true);
    },
  );

  test.each(Object.keys(BuiltInThirdPartySignalType))(
    'GraphQL SignalType enum includes BuiltInThirdPartySignalType: %s',
    (name) => {
      expect(graphQlSignalTypes.has(name)).toBe(true);
    },
  );
});
