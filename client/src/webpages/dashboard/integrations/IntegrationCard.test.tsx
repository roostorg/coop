import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import type { GQLIntegrationMetadata } from '../../../graphql/generated';
import IntegrationCard from './IntegrationCard';

function renderCard(options: { active?: boolean } = {}) {
  const integration: GQLIntegrationMetadata = {
    __typename: 'IntegrationMetadata',
    name: 'ZENTROPI',
    title: 'Zentropi',
    docsUrl: 'https://zentropi.ai/api',
    requiresConfig: true,
    logoUrl: null,
    logoWithBackgroundUrl: null,
    modelCards: [
      {
        __typename: 'ModelCard',
        modelName: 'CoPE-B-A4B',
        version: '',
        releaseDate: 'May 2026',
        sections: [],
      },
      {
        __typename: 'ModelCard',
        modelName: 'CoPE-B-S1',
        version: '1.0',
        releaseDate: 'October 2026',
        sections: [],
      },
    ],
  };
  return render(
    <MemoryRouter>
      <IntegrationCard integration={integration} active={options.active} />
    </MemoryRouter>,
  );
}

describe('IntegrationCard', () => {
  it('lists the model count and one row per model', () => {
    renderCard();
    expect(screen.getByText('2 MODELS')).toBeInTheDocument();
    expect(screen.getByText('CoPE-B-A4B')).toBeInTheDocument();
    expect(screen.getByText('CoPE-B-S1')).toBeInTheDocument();
    // Version and release date join with a separator, matching the config tabs.
    expect(screen.getByText('1.0 · October 2026')).toBeInTheDocument();
    expect(screen.getByText('May 2026')).toBeInTheDocument();
  });

  it('shows ACTIVE at the integration level only when configured', () => {
    renderCard({ active: true });
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it('shows no ACTIVE marker when not configured', () => {
    renderCard();
    expect(screen.queryByText(/Active/i)).not.toBeInTheDocument();
  });
});
