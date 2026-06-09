import { Calendar, CalendarProps } from '@/coop-ui/Calendar';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '@testing-library/jest-dom/extend-expect';

import { vi } from 'vitest';

describe('Calendar Component', () => {
  const renderCalendar = (props: CalendarProps) =>
    render(<Calendar {...props} />);

  test('renders calendar with single mode and selected date', () => {
    const selectedDate = new Date(2026, 5, 15);
    renderCalendar({
      mode: 'single',
      selected: selectedDate,
    });

    const selectedDay = screen.getByText('15');
    expect(selectedDay).toHaveAttribute('aria-selected', 'true');
  });

  test('renders calendar with multiple mode and selected dates', () => {
    const selectedDates = [new Date(2026, 5, 15), new Date(2026, 5, 16)];
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
    const onSelect = vi.fn();
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
    const onSelect = vi.fn();
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
    const onSelect = vi.fn();
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
