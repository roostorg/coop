import { Calendar, CalendarProps } from '@/coop-ui/Calendar';
import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';

export default {
  title: 'Components/Calendar',
  component: Calendar,
} as Meta;

const Template: StoryFn<CalendarProps> = (args) => {
  /* @ts-ignore */
  const [selectedDates, setSelectedDates] = React.useState(args.selected);

  const handleSelect = (dates: any) => {
    action('onSelect')(dates);
    setSelectedDates(dates);
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* @ts-ignore */}
      <Calendar {...args} selected={selectedDates} onSelect={handleSelect} />
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  mode: 'single',
  selected: new Date(),
};

export const Multiple = Template.bind({});
Multiple.args = {
  mode: 'multiple',
  selected: [
    new Date(),
    new Date(new Date().setDate(new Date().getDate() + 3)),
  ],
};

export const Range = Template.bind({});
Range.args = {
  mode: 'range',
  selected: {
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 7)),
  },
};
