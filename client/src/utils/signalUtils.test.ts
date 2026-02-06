import { GQLIntegration } from '../graphql/generated';
import {
  createSubcategoryIdToLabelMapping,
  rebuildSubcategoryTreeFromGraphQLResponse,
} from './signalUtils';

describe('Signal Utils Tests', () => {
  describe('Test should recreate subcategory tree from flattened list', () => {
    test('Should recreate subcategories correctly', () => {
      const flattenedSubcategories = [
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
      const expectedSubcategoryTree = [
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
      ];

      expect(
        rebuildSubcategoryTreeFromGraphQLResponse(flattenedSubcategories),
      ).toEqual(expectedSubcategoryTree);
    });
    test('Should recreate Rekognition subcategories correctly', () => {
      const flattenedSubcategories = [
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
      const expectedSubcategoryTree = [
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
      ];

      expect(
        rebuildSubcategoryTreeFromGraphQLResponse(flattenedSubcategories),
      ).toEqual(expectedSubcategoryTree);
    });
  });
  describe('Test should generate flattened mapping of subcategories to their display names', () => {
    test.skip('Should generate flattened mapping of subcategories to their display names for single integration', () => {
      const signals = [
        {
          integration: GQLIntegration.OpenAi,
          eligibleSubcategories: [
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
          ],
        },
      ];

      const expectedSubcategoryMapping = {
        'OPEN_AI:Hate Groups': 'Hate Groups',
        'OPEN_AI:yes_nazi': 'Nazi Content',
        'OPEN_AI:yes_terrorist': 'Terrorist Content',
        'OPEN_AI:yes_kkk': 'White Supremacist Content',
        'OPEN_AI:Rude Gestures': 'Rude Gestures',
        'OPEN_AI:yes_middle_finger': 'Middle Finger',
      };

      expect(createSubcategoryIdToLabelMapping(signals)).toEqual(
        expectedSubcategoryMapping,
      );
    });
    test.skip('Should generate flattened mapping of subcategories to their display names for multiple integrations', () => {
      const signals = [
        {
          integration: GQLIntegration.OpenAi,
          eligibleSubcategories: [
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
          ],
        },
      ];

      const expectedSubcategoryMapping = {
        'OPEN_AI:Hate Groups': 'Hate Groups',
        'OPEN_AI:yes_nazi': 'Nazi Content',
        'OPEN_AI:yes_terrorist': 'Terrorist Content',
        'OPEN_AI:yes_kkk': 'White Supremacist Content',
        'OPEN_AI:Rude Gestures': 'Rude Gestures',
        'OPEN_AI:yes_middle_finger': 'Middle Finger',
      };

      expect(createSubcategoryIdToLabelMapping(signals)).toEqual(
        expectedSubcategoryMapping,
      );
    });
  });
});
