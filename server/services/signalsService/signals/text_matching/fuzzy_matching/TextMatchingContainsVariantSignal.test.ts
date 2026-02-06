import TextMatchingContainsVariantSignal from './TextMatchingContainsVariantSignal.js';

describe('TextMatchingContainsVariantSignal', () => {
  it.skip('Should not get less accurate from normalization', async () => {
    // Arrange
    const signal = new TextMatchingContainsVariantSignal();

    // Act
    const result = await signal.run({
      matchingValues: ['6mwe'],
      value: { type: 'STRING', value: '6mmwe' },
      orgId: 'na',
      actionPenalties: undefined,
    });

    // Assert
    // We have a normalization step that converts 6mwe to 6rnwe, on the
    // assumption that rn might be written in place of m. However, when we try
    // to generate a variant regex for 6mwe, we get a regex that matches
    // 6{1,}r{1,}n{1,}w{1,}e{1,} and this fails to match the normalized version
    // of 6mmwe, which looks like 6rnrnwe. So, this test, when it passes, should
    // verify that the normalization step doesn't make the regex less accurate.
    // The proper regex would be 6{1,}(rn){1,}w{1,}e{1,}.
    expect(result.score).toBe(true);
  });
});
