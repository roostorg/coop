import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import { Button } from '@/coop-ui/Button';

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from './Popover';

describe('Popover component', () => {
  it('renders PopoverTrigger and PopoverContent correctly', () => {
    render(
      <Popover>
        <PopoverAnchor>
          <PopoverTrigger asChild>
            <Button>Open Popover</Button>
          </PopoverTrigger>
        </PopoverAnchor>
        <PopoverContent>This is the content of the popover.</PopoverContent>
      </Popover>,
    );

    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('opens the popover content on trigger click', () => {
    render(
      <Popover>
        <PopoverAnchor>
          <PopoverTrigger asChild>
            <Button>Open Popover</Button>
          </PopoverTrigger>
        </PopoverAnchor>
        <PopoverContent>This is the content of the popover.</PopoverContent>
      </Popover>,
    );

    const triggerButton = screen.getByText('Open Popover');

    expect(
      screen.queryByText('This is the content of the popover.'),
    ).not.toBeInTheDocument();

    fireEvent.click(triggerButton);

    expect(
      screen.getByText('This is the content of the popover.'),
    ).toBeInTheDocument();
  });
});
