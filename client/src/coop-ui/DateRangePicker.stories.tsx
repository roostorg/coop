import {
  DateRangePicker,
  DateRangePickerProps,
} from '@/coop-ui/DateRangePicker';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/DateRangePicker',
  component: DateRangePicker,
} as Meta;

const Template: StoryFn<DateRangePickerProps> = (args) => (
  <DateRangePicker {...args} />
);

export const Default = Template.bind({});
Default.args = {
  onUpdate: (values) => console.log('Updated values:', values),
};

export const SingleMonth = Template.bind({});
SingleMonth.args = {
  onUpdate: (values) => console.log('Updated values:', values),
  isSingleMonthOnly: true,
};

export const WithSetRange = Template.bind({});
WithSetRange.args = {
  initialDateFrom: new Date(),
  initialDateTo: new Date(new Date().setDate(new Date().getDate() + 3)),
  onUpdate: (values) => console.log('Updated values:', values),
};
