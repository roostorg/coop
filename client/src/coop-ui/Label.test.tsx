import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom/extend-expect';

import { Label } from '@/coop-ui/Label';

describe('Label Component', () => {
  test('renders the label with default properties', () => {
    render(<Label htmlFor="test-label">Test Label</Label>);
    const labelElement = screen.getByText('Test Label');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveAttribute('for', 'test-label');
  });
});
