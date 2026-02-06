import { Calendar, CalendarProps } from '@/coop-ui/Calendar';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import '@testing-library/jest-dom/extend-expect';

describe('Calendar Component', () => {
  const renderCalendar = (props: CalendarProps) =>
    render(<Calendar {...props} />);

  test('renders calendar with single mode and selected date', () => {
    const selectedDate = new Date();
    renderCalendar({
      mode: 'single',
      selected: selectedDate,
    });

    const selectedDay = screen.getByText(selectedDate.getDate().toString());
    expect(selectedDay).toHaveAttribute('aria-selected', 'true');
  });

  test('renders calendar with multiple mode and selected dates', () => {
    const selectedDates = [
      new Date(),
      new Date(new Date().setDate(new Date().getDate() + 1)),
    ];
    renderCalendar({
      mode: 'multiple',
      selected: selectedDates,
    });

    selectedDates.forEach((date) => {
      const selectedDay = screen.getByText(date.getDate().toString());
      expect(selectedDay).toHaveAttribute('aria-selected', 'true');
    });
  });

  test('calls onSelect when a date is clicked in single mode', () => {
    const onSelect = jest.fn();
    renderCalendar({
      mode: 'single',
      onSelect,
    });

    const dayToSelect = screen.getByText('15');
    userEvent.click(dayToSelect);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  test('calls onSelect with multiple dates in multiple mode', () => {
    const onSelect = jest.fn();
    renderCalendar({
      mode: 'multiple',
      onSelect,
    });

    const firstDayToSelect = screen.getByText('15');
    const secondDayToSelect = screen.getByText('16');
    userEvent.click(firstDayToSelect);
    userEvent.click(secondDayToSelect);

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[0][0]).toBeInstanceOf(Array);
    expect(onSelect.mock.calls[0][0][0]).toBeInstanceOf(Date);
  });

  test('calls onSelect with a date range in range mode', async () => {
    const onSelect = jest.fn();
    renderCalendar({
      mode: 'range',
      onSelect,
    });

    const firstDayToSelect = screen.getByText('15');
    const secondDayToSelect = screen.getByText('16');
    userEvent.click(firstDayToSelect);
    userEvent.click(secondDayToSelect);

    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
