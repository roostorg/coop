import { describe, expect, it, vi } from 'vitest';

import PluginSignalAdapter from '../signals/PluginSignalAdapter.js';
import { findUnavailablePluginSubcategory } from './findUnavailablePluginSubcategory.js';

const POLICIES = [
  { id: 'root', label: 'Root', childrenIds: ['child'] },
  { id: 'child', label: 'Child', childrenIds: [] },
];

function makeSignal(eligibleSubcategories = POLICIES) {
  return new PluginSignalAdapter({
    id: { type: 'POLICY_SIGNAL' },
    displayName: 'Policy signal',
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
    integration: 'TEST',
    allowedInAutomatedRules: true,
  });
}

describe('findUnavailablePluginSubcategory', () => {
  it('returns a permanent error for an unknown subcategory', () => {
    const result = findUnavailablePluginSubcategory(
      makeSignal(),
      'removed-policy',
    );

    expect(result).toMatchObject({
      type: 'ERROR',
      score: { name: 'SignalPermanentError' },
    });
  });

  it('returns an error when the signal no longer offers any policies', () => {
    expect(
      findUnavailablePluginSubcategory(makeSignal([]), 'root'),
    ).toMatchObject({ type: 'ERROR' });
  });

  it.each(['root', 'child', undefined])(
    'allows known or absent subcategories: %s',
    (subcategory) => {
      expect(
        findUnavailablePluginSubcategory(makeSignal(), subcategory),
      ).toBeUndefined();
    },
  );
});
