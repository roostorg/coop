import { credentialIsConfigured } from './IntegrationApi.js';
import type { IntegrationManifestEntry } from './integrationManifests.js';

function manifestWith(
  configurationFields?: IntegrationManifestEntry['configurationFields'],
): IntegrationManifestEntry {
  return {
    modelCard: { modelName: 'Test Model', version: '1.0' },
    title: 'Test',
    docsUrl: 'https://example.com',
    requiresConfig: true,
    configurationFields,
  };
}

describe('credentialIsConfigured', () => {
  it.each(['GOOGLE_CONTENT_SAFETY_API', 'OPEN_AI', 'ZENTROPI'])(
    'reports a built-in %s credential as configured only with an API key',
    (integrationId) => {
      const manifest = manifestWith();
      expect(
        credentialIsConfigured(integrationId, { apiKey: 'sk-test' }, manifest),
      ).toBe(true);
      expect(
        credentialIsConfigured(integrationId, { apiKey: '' }, manifest),
      ).toBe(false);
      expect(credentialIsConfigured(integrationId, {}, manifest)).toBe(false);
    },
  );

  it('requires every required plugin field to have a value', () => {
    const manifest = manifestWith([
      {
        key: 'apiKey',
        label: 'API key',
        required: true,
        inputType: 'password',
      },
      { key: 'endpoint', label: 'Endpoint', required: true, inputType: 'text' },
      { key: 'headers', label: 'Headers', required: false, inputType: 'json' },
    ]);
    expect(
      credentialIsConfigured(
        'MY_PLUGIN',
        { apiKey: 'k', endpoint: 'https://example.com' },
        manifest,
      ),
    ).toBe(true);
    expect(credentialIsConfigured('MY_PLUGIN', { apiKey: 'k' }, manifest)).toBe(
      false,
    );
    expect(
      credentialIsConfigured(
        'MY_PLUGIN',
        { apiKey: 'k', endpoint: '   ' },
        manifest,
      ),
    ).toBe(false);
  });

  it('counts any saved value for a plugin without required fields', () => {
    const manifest = manifestWith([
      { key: 'headers', label: 'Headers', required: false, inputType: 'json' },
    ]);
    expect(
      credentialIsConfigured('MY_PLUGIN', { headers: { a: 1 } }, manifest),
    ).toBe(true);
    expect(credentialIsConfigured('MY_PLUGIN', { headers: '' }, manifest)).toBe(
      false,
    );
    expect(credentialIsConfigured('MY_PLUGIN', {}, manifest)).toBe(false);
  });
});
