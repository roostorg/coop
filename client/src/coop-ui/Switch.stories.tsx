import { Label } from '@/coop-ui/Label';
import { Switch } from '@/coop-ui/Switch';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/Switch',
  component: Switch,
} as Meta;

export const SwitchDemo: StoryFn = () => <Switch id="airplane-mode" />;

export const SwitchWithTextLabel: StoryFn = () => (
  <div className="flex items-center space-x-2">
    <Switch id="notifications" />
    <Label htmlFor="notifications">Enable Notifications</Label>
  </div>
);

export const DisabledSwitch: StoryFn = () => (
  <div className="flex items-center space-x-2">
    <Switch id="notifications-disabled" disabled />
    <Label htmlFor="notifications-disabled" className="text-gray-400">
      Notifications (Disabled)
    </Label>
  </div>
);
