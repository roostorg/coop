import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  GQLIntegrationContextKind,
  GQLIntegrationContextMode,
  type GQLIntegrationContextOption,
} from '../../../graphql/generated';
import IntegrationContextSettingsSection, {
  type IntegrationContextSetting,
} from './IntegrationContextSettingsSection';

function option(
  overrides: Partial<GQLIntegrationContextOption> = {},
): GQLIntegrationContextOption {
  return {
    __typename: 'IntegrationContextOption',
    kind: GQLIntegrationContextKind.Thread,
    defaultMode: GQLIntegrationContextMode.Include,
    mode: GQLIntegrationContextMode.Default,
    included: true,
    maxCount: null,
    defaultMaxCount: 10,
    maxCountLimit: 50,
    ...overrides,
  };
}

function renderSection(
  options: GQLIntegrationContextOption[],
  value = options.map<IntegrationContextSetting>((contextOption) => ({
    kind: contextOption.kind,
    mode: contextOption.mode,
    maxCount: contextOption.maxCount ?? null,
  })),
  onChange = vi.fn(),
) {
  return {
    onChange,
    ...render(
      <IntegrationContextSettingsSection
        options={options}
        value={value}
        onChange={onChange}
        disabled={false}
      />,
    ),
  };
}

describe('IntegrationContextSettingsSection', () => {
  it('renders nothing for empty options', () => {
    const { container } = renderSection([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders labels, default mode, placeholder, and limit', () => {
    renderSection([option()]);

    expect(screen.getByText('Evaluation context')).toBeInTheDocument();
    expect(screen.getByText('Thread context')).toBeInTheDocument();
    expect(
      screen.getByText('Use integration default (Include)'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Max messages')).toHaveAttribute(
      'placeholder',
      'Default: 10',
    );
    expect(screen.getByText('Up to 50')).toBeInTheDocument();
  });

  it('disables the count input when the effective mode is off', () => {
    renderSection([
      option({
        mode: GQLIntegrationContextMode.Default,
        defaultMode: GQLIntegrationContextMode.Off,
      }),
    ]);

    expect(screen.getByLabelText('Max messages')).toBeDisabled();
  });

  it('reports select and count changes', () => {
    const initial = [option()];
    const onChange = vi.fn();
    renderSection(initial, undefined, onChange);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Off'));
    expect(onChange).toHaveBeenCalledWith([
      {
        kind: GQLIntegrationContextKind.Thread,
        mode: GQLIntegrationContextMode.Off,
        maxCount: null,
      },
    ]);

    fireEvent.change(screen.getByLabelText('Max messages'), {
      target: { value: '25' },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      {
        kind: GQLIntegrationContextKind.Thread,
        mode: GQLIntegrationContextMode.Default,
        maxCount: 25,
      },
    ]);
  });
});
