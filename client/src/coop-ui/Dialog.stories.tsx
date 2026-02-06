import { Button } from '@/coop-ui/Button';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

const meta: Meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    docs: {
      description: {
        component:
          'A customizable dialog component built with Radix UI and styled using Tailwind CSS.',
      },
    },
  },
};

export default meta;

const Template: StoryFn = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Open Dialog</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Dialog Title</DialogTitle>
        <DialogCloseButton />
      </DialogHeader>
      <DialogDescription>
        This is the dialog content area. You can place any informational text or
        interactive elements here.
      </DialogDescription>
      <DialogFooter>
        <Button variant="white">Cancel</Button>
        <Button>Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const Default = Template.bind({});
Default.storyName = 'Default Dialog';
