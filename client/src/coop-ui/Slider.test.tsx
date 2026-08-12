import { render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import { Slider } from '@/coop-ui/Slider';

describe('Slider Component', () => {
  test('renders the slider component', () => {
    render(<Slider defaultValue={[50]} max={100} step={1} />);
    const sliderThumb = screen.getByRole('slider');
    expect(sliderThumb).toBeInTheDocument();
  });
});
