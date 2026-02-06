import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './Drawer';

export default {
  title: 'Components/Drawer',
  component: Drawer,
  subcomponents: {
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
  },
} as Meta;

// TODO: A small improvement would be to use shadcn components inside

const Template: StoryFn = (args) => (
  <Drawer {...args}>
    <DrawerTrigger asChild>
      <div>Open Drawer</div>
    </DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Drawer Title</DrawerTitle>
        <DrawerDescription>
          This is a description for the drawer content.
        </DrawerDescription>
      </DrawerHeader>
      <div className="p-4">
        <p>Here is some content inside the drawer.</p>
      </div>
      <DrawerFooter>
        <DrawerClose asChild>
          <div>Close Drawer</div>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);

export const Default = Template.bind({});
Default.args = {
  shouldScaleBackground: true,
};
