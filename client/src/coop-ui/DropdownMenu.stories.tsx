import { Button } from '@/coop-ui/Button';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';

export default {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
} as Meta;

export const Default: StoryFn = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button>Open menu</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>My account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Profile</DropdownMenuItem>
      <DropdownMenuItem>Settings</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>Log out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
