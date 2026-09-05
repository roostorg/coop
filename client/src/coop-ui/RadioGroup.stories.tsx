import { Label } from '@/coop-ui/Label';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { RadioGroup, RadioGroupItem } from './RadioGroup';

export default {
  title: 'Components/RadioGroup',
  component: RadioGroup,
} as Meta;

export const Default: StoryFn = () => (
  <RadioGroup defaultValue="comfortable">
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="default" id="r1" />
      <Label htmlFor="r1">Default</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="comfortable" id="r2" />
      <Label htmlFor="r2">Comfortable</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="compact" id="r3" />
      <Label htmlFor="r3">Compact</Label>
    </div>
  </RadioGroup>
);

export const Disabled: StoryFn = () => (
  <RadioGroup defaultValue="one">
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="one" id="d1" />
      <Label htmlFor="d1">Enabled</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="two" id="d2" disabled />
      <Label htmlFor="d2">Disabled</Label>
    </div>
  </RadioGroup>
);
