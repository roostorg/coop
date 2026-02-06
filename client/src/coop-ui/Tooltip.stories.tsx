import { Button } from '@/coop-ui/Button';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';

export default {
  title: 'Components/Tooltip',
  component: Tooltip,
  subcomponents: { TooltipTrigger, TooltipContent, TooltipProvider },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} as Meta;

const Template: StoryFn = (args) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Hover</Button>
    </TooltipTrigger>
    <TooltipContent {...args}>Tooltip content here</TooltipContent>
  </Tooltip>
);

export const Default = Template.bind({});
Default.args = {
  sideOffset: 4,
};

export const DifferentPosition = Template.bind({});
DifferentPosition.args = {
  sideOffset: 40,
  side: 'right',
};
