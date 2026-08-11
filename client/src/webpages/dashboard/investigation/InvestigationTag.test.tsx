import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import '@testing-library/jest-dom';

import InvestigationTag from './InvestigationTag';

afterEach(() => {
  vi.restoreAllMocks();
});

it('renders a keyed investigation tag without reading the reserved key prop', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(<InvestigationTag key="tag-key" title="Policy title" />);

  expect(screen.getByText('Policy title')).toHaveClass(
    'p-2',
    'm-0.5',
    'rounded-md',
    'border-solid',
    'border-gray-200',
    'text-gray-500',
    'bg-gray-50',
  );
  expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
    '`key` is not a prop',
  );
});
