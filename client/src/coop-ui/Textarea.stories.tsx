import { Button } from '@/coop-ui/Button';
import { Textarea, TextareaProps } from '@/coop-ui/Textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/coop-ui/Tooltip';
import { Text } from '@/coop-ui/Typography';
import { Meta, StoryFn } from '@storybook/react';
import { Clipboard } from 'lucide-react';
import React from 'react';

const meta: Meta = {
  title: 'Components/Textarea',
  component: Textarea,
  parameters: {
    docs: {
      description: {
        component:
          'A customizable textarea component with optional start and end slots.',
      },
    },
  },
  argTypes: {
    startSlot: { control: false },
    endSlot: { control: false },
  },
};

export default meta;

const Template: StoryFn<TextareaProps> = (args) => <Textarea {...args} />;

export const Default = Template.bind({});
Default.args = {
  placeholder: 'Enter text',
  className: 'w-400',
};

export const Disabled = Template.bind({});
Disabled.args = {
  placeholder: 'Enter text',
  disabled: true,
  className: 'w-400',
};

export const WithStartSlot = Template.bind({});
WithStartSlot.args = {
  placeholder: 'Enter text...',
  className: 'w-400',
  startSlot: (
    <div className="flex items-center px-2 rounded-l-lg bg-red-500">
      <Text className="text-white">Start slot</Text>
    </div>
  ),
};

export const WithEndSlot = Template.bind({});
WithEndSlot.args = {
  placeholder: 'Enter text...',
  className: 'w-400',
  endSlot: (
    <div className="flex items-center px-2 rounded-r-lg border-l-0 bg-red-500">
      <Text className="text-white">End slot</Text>
    </div>
  ),
};

export const WithMoreComplexEndSlot = Template.bind({});
WithMoreComplexEndSlot.args = {
  placeholder: 'Enter text',
  className: 'w-400',
  endSlot: (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="white"
            className="rounded-none rounded-r-lg border-l-0"
            onClick={() => {}}
          >
            <Clipboard className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copy to clipboard</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
