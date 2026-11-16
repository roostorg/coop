import { Label } from '@/coop-ui/Label';
import { render, screen } from '@testing-library/react';

describe('Label Component', () => {
  test('renders the label with default properties', () => {
    render(<Label htmlFor="test-label">Test Label</Label>);
    const labelElement = screen.getByText('Test Label');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveAttribute('for', 'test-label');
  });
});
