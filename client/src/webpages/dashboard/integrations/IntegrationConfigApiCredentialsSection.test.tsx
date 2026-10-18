import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import IntegrationConfigApiCredentialsSection from './IntegrationConfigApiCredentialsSection';

const fields = [
  {
    key: 'apiKey',
    label: 'API key',
    required: true,
    inputType: 'PASSWORD' as const,
    placeholder: null,
    description: 'Your Pigeon bearer token.',
  },
  {
    key: 'baseUrl',
    label: 'Base URL',
    required: false,
    inputType: 'TEXT' as const,
    placeholder: 'https://api.example.com',
    description: null,
  },
];

describe('IntegrationConfigApiCredentialsSection (plugin fields)', () => {
  it('renders an input per declared field', () => {
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: {},
        }}
        setApiCredential={vi.fn()}
        configurationFields={fields}
      />,
    );

    const apiKey = screen.getByLabelText(/API key/);
    expect(apiKey.getAttribute('type')).toBe('password');
    expect(apiKey.getAttribute('aria-required')).toBe('true');
    expect(screen.getByText('Your Pigeon bearer token.')).toBeTruthy();
    expect(screen.getByLabelText('Base URL').getAttribute('placeholder')).toBe(
      'https://api.example.com',
    );
    expect(screen.queryByText(/True percentage/)).toBeNull();
  });

  it('updates the credential by field key', () => {
    const setApiCredential = vi.fn();
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: { baseUrl: 'https://api.example.com' },
        }}
        setApiCredential={setApiCredential}
        configurationFields={fields}
      />,
    );

    fireEvent.change(screen.getByLabelText(/API key/), {
      target: { value: 'test-api-key' },
    });

    expect(setApiCredential).toHaveBeenCalledWith({
      __typename: 'PluginIntegrationApiCredential',
      credential: {
        baseUrl: 'https://api.example.com',
        apiKey: 'test-api-key',
      },
    });
  });

  it('renders select fields as a dropdown showing the chosen option', () => {
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: { threadContext: 'flatten' },
        }}
        setApiCredential={vi.fn()}
        configurationFields={[
          {
            key: 'threadContext',
            label: 'Thread context',
            required: false,
            inputType: 'SELECT' as const,
            options: [
              {
                __typename: 'IntegrationConfigFieldOption',
                value: 'skip',
                label: 'Skip',
              },
              {
                __typename: 'IntegrationConfigFieldOption',
                value: 'flatten',
                label: 'Include earlier messages',
              },
            ],
            placeholder: null,
            description: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Include earlier messages')).toBeTruthy();
    expect(screen.queryByDisplayValue('flatten')).toBeNull();
  });

  it('saves the option value when a select changes', () => {
    const setApiCredential = vi.fn();
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: {},
        }}
        setApiCredential={setApiCredential}
        configurationFields={[
          {
            key: 'region',
            label: 'Region',
            required: true,
            inputType: 'SELECT' as const,
            options: [
              {
                __typename: 'IntegrationConfigFieldOption',
                value: 'us',
                label: 'United States',
              },
              {
                __typename: 'IntegrationConfigFieldOption',
                value: 'eu',
                label: 'European Union',
              },
            ],
            placeholder: null,
            description: null,
          },
        ]}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByTitle('European Union'));

    expect(setApiCredential).toHaveBeenCalledWith({
      __typename: 'PluginIntegrationApiCredential',
      credential: { region: 'eu' },
    });
  });

  it('shows JSON values as editable text', () => {
    const setApiCredential = vi.fn();
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: { headers: { 'X-Team': 'trust' } },
        }}
        setApiCredential={setApiCredential}
        configurationFields={[
          {
            key: 'headers',
            label: 'Headers',
            required: false,
            inputType: 'JSON' as const,
            placeholder: null,
            description: null,
          },
        ]}
      />,
    );

    const textarea = screen.getByLabelText('Headers');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect((textarea as HTMLTextAreaElement).value).toBe('{"X-Team":"trust"}');

    fireEvent.change(textarea, { target: { value: '{"X-Team":"safety"}' } });
    expect(setApiCredential).toHaveBeenCalledWith({
      __typename: 'PluginIntegrationApiCredential',
      credential: { headers: '{"X-Team":"safety"}' },
    });
  });

  it('edits array fields as a list of values', () => {
    const setApiCredential = vi.fn();
    render(
      <IntegrationConfigApiCredentialsSection
        name="PIGEON"
        apiCredential={{
          __typename: 'PluginIntegrationApiCredential',
          credential: { languages: ['en'] },
        }}
        setApiCredential={setApiCredential}
        configurationFields={[
          {
            key: 'languages',
            label: 'Languages',
            required: false,
            inputType: 'ARRAY' as const,
            placeholder: null,
            description: null,
          },
        ]}
      />,
    );

    expect(screen.getByText('en')).toBeTruthy();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'fr,' } });

    expect(setApiCredential).toHaveBeenCalledWith({
      __typename: 'PluginIntegrationApiCredential',
      credential: { languages: ['en', 'fr'] },
    });
  });
});
