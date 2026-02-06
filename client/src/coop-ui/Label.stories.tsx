import { Label } from '@/coop-ui/Label';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/Label',
  component: Label,
} as Meta;

export const DefaultLabel: StoryFn = () => <Label>Label</Label>;
