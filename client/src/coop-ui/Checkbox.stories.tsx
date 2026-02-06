import { Label } from '@/coop-ui/Label';
import { Link } from '@/coop-ui/Link';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Checkbox } from './Checkbox';

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
} as Meta;

export const DefaultCheckbox: StoryFn = () => (
  <div>
    <Checkbox />
  </div>
);

export const CheckboxWithText: StoryFn = () => (
  <div className="flex items-top space-x-2">
    <Checkbox id="terms1" />
    <div className="grid gap-1.5 leading-none">
      <label
        htmlFor="terms1"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Accept terms and conditions
      </label>
      <p className="text-sm text-muted-foreground">
        You agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  </div>
);

export const CheckboxDisabled: StoryFn = () => (
  <div className="flex items-center space-x-2">
    <Checkbox id="terms2" disabled />
    <label
      htmlFor="terms2"
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      Accept terms and conditions
    </label>
  </div>
);

// TODO: when available update the example with coop-ui Link component
export const CheckboxLongLabel = () => (
  <div className="flex items-center space-x-2">
    <Checkbox id="agreement" />
    <Label htmlFor="agreement">
      I have read, understood, and agree to the{' '}
      <Link href="/terms" target="_blank">
        Terms of Use
      </Link>{' '}
      and{' '}
      <Link href="/privacy" target="_blank">
        Privacy Policy
      </Link>{' '}
      provided herein.
    </Label>
  </div>
);
