import { Button } from '@/coop-ui/Button';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export default {
  title: 'Components/Popover',
  component: Popover,
} as Meta;

const Template: StoryFn = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button>Open</Button>
    </PopoverTrigger>
    <PopoverContent className="w-56">
      <p className="text-sm">This is the content of the popover.</p>
    </PopoverContent>
  </Popover>
);

export const Default = Template.bind({});
Default.args = {};
