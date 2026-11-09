import type { PluginSignalDescriptor } from '@roostorg/coop-types';
import { vi } from 'vitest';

import PluginSignalAdapter from './PluginSignalAdapter.js';

function descriptor(
  eligibleSubcategories: PluginSignalDescriptor['eligibleSubcategories'],
): PluginSignalDescriptor {
  return {
    id: { type: 'ACME_POLICY_SIGNAL' },
    displayName: 'Acme policies',
    description: 'test',
    docsUrl: null,
    recommendedThresholds: null,
    supportedLanguages: 'ALL',
    pricingStructure: { type: 'FREE' },
    eligibleInputs: ['STRING'],
    outputType: { scalarType: 'NUMBER' },
    getCost: () => 1,
    run: vi.fn(),
    getDisabledInfo: async () => ({ disabled: false }),
    needsMatchingValues: false,
    eligibleSubcategories,
    needsActionPenalties: false,
    integration: 'ACME',
    allowedInAutomatedRules: true,
  };
}

describe('PluginSignalAdapter policies', () => {
  it('keeps standalone policies as roots', () => {
    const signal = new PluginSignalAdapter(
      descriptor([
        { id: 'HARASSMENT', label: 'Harassment', childrenIds: ['THREATS'] },
        { id: 'THREATS', label: 'Threats', childrenIds: [] },
        { id: 'SPAM', label: 'Spam', childrenIds: [] },
      ]),
    );

    expect(signal.eligibleSubcategories.map((it) => it.id)).toEqual([
      'HARASSMENT',
      'SPAM',
    ]);
  });

  it.each([
    [
      'duplicate IDs',
      [
        { id: 'SPAM', label: 'Spam', childrenIds: [] },
        { id: 'SPAM', label: 'Spam again', childrenIds: [] },
      ],
      /unique/,
    ],
    [
      'an unknown child',
      [{ id: 'HARASSMENT', label: 'Harassment', childrenIds: ['MISSING'] }],
      /unknown child "MISSING"/,
    ],
    [
      'a grandchild',
      [
        { id: 'A', label: 'A', childrenIds: ['B'] },
        { id: 'B', label: 'B', childrenIds: ['C'] },
        { id: 'C', label: 'C', childrenIds: [] },
      ],
      /"B" is a child and can't have children/,
    ],
    [
      'a cycle',
      [
        { id: 'A', label: 'A', childrenIds: ['B'] },
        { id: 'B', label: 'B', childrenIds: ['A'] },
      ],
      /can't have children/,
    ],
    [
      'a child with two parents',
      [
        { id: 'A', label: 'A', childrenIds: ['C'] },
        { id: 'B', label: 'B', childrenIds: ['C'] },
        { id: 'C', label: 'C', childrenIds: [] },
      ],
      /"C" has more than one parent/,
    ],
  ])('rejects %s when the plugin loads', (_case, policies, message) => {
    expect(() => new PluginSignalAdapter(descriptor(policies))).toThrow(
      message,
    );
  });
});
