import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/Slider',
  component: Slider,
} as Meta;

export const DefaultSlider: StoryFn = () => (
  <Slider defaultValue={[50]} max={100} step={1} />
);

export const SliderWithLabel: StoryFn = () => (
  <div className="flex items-center gap-2">
    <Label htmlFor="id">Label</Label>
    <Slider id="id" defaultValue={[50]} max={100} step={1} />
  </div>
);

export const RangeSlider: StoryFn = () => (
  <Slider defaultValue={[20, 80]} max={100} step={1} />
);

export const DisabledSlider: StoryFn = () => (
  <Slider defaultValue={[50]} max={100} step={1} disabled />
);
