import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  differenceInMilliseconds,
  endOfDay,
  formatDistance,
  startOfDay,
  startOfHour,
} from 'date-fns';
import React from 'react';
import { vi } from 'vitest';

describe('DateRangePicker', () => {
  it('should render without crashing', () => {
    render(
      <DateRangePicker
        initialDateFrom="2023-01-01"
        initialDateTo="2023-12-31"
      />,
    );
    expect(screen.getByText(/Jan 1, 2023 - Dec 31, 2023/)).toBeInTheDocument();
  });

  it('should display the PopoverContent when PopoverTrigger button is clicked', () => {
    render(
      <DateRangePicker
        initialDateFrom="2023-01-01"
        initialDateTo="2023-12-31"
      />,
    );

    const triggerButton = screen.getByRole('button', {
      name: /Jan 1, 2023 - Dec 31, 2023/i,
    });
    fireEvent.click(triggerButton);

    // Check if "Update" button in PopoverContent is visible now
    expect(screen.getByRole('button', { name: /Update/i })).toBeVisible();
  });

  it('should call onUpdate with the correct value when date is selected', async () => {
    const onUpdateMock = vi.fn();
    render(
      <DateRangePicker
        initialDateFrom="2023-01-01"
        initialDateTo="2023-12-31"
        onUpdate={onUpdateMock}
      />,
    );

    const triggerButton = screen.getByRole('button', {
      name: /Jan 1, 2023 - Dec 31, 2023/i,
    });
    fireEvent.click(triggerButton);

    // Get all input fields with placeholder text 'MM', 'DD', and 'YYYY'
    const dateFromMonthInput = screen.getAllByPlaceholderText('M')[0];
    const dateToMonthInput = screen.getAllByPlaceholderText('M')[1];
    const dateFromDayInput = screen.getAllByPlaceholderText('D')[0];
    const dateToDayInput = screen.getAllByPlaceholderText('D')[1];
    const dateFromYearInput = screen.getAllByPlaceholderText('YYYY')[0];
    const dateToYearInput = screen.getAllByPlaceholderText('YYYY')[1];

    fireEvent.change(dateFromMonthInput, { target: { value: '02' } });
    fireEvent.change(dateFromDayInput, { target: { value: '01' } });
    fireEvent.change(dateFromYearInput, { target: { value: '2023' } });
    fireEvent.change(dateToMonthInput, { target: { value: '03' } });
    fireEvent.change(dateToDayInput, { target: { value: '30' } });
    fireEvent.change(dateToYearInput, { target: { value: '2023' } });

    const updateButton = screen.getByRole('button', { name: /Update/i });
    fireEvent.click(updateButton);

    expect(onUpdateMock).toHaveBeenCalledWith({
      range: {
        from: startOfDay(new Date(2023, 1, 1)),
        to: endOfDay(new Date(2023, 2, 30)),
      },
    });
  });

  // Editing only the end day must still emit a full inclusive local-day window.
  it('normalizes to inclusive local days when only the end date inputs change', () => {
    const onUpdateMock = vi.fn();
    const initialFrom = startOfHour(new Date(2026, 10, 4, 14, 47));
    const initialTo = startOfHour(new Date(2026, 10, 11, 14, 47));

    render(
      <DateRangePicker
        initialDateFrom={initialFrom}
        initialDateTo={initialTo}
        onUpdate={onUpdateMock}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Nov 4, 2026 - Nov 11, 2026/i }),
    );

    const dateToDayInput = screen.getAllByPlaceholderText('D')[1];
    fireEvent.change(dateToDayInput, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Update/i }));

    expect(onUpdateMock).toHaveBeenCalledTimes(1);
    const range = onUpdateMock.mock.calls[0][0].range as {
      from: Date;
      to: Date;
    };

    expect(range.from).toEqual(startOfDay(new Date(2026, 10, 4)));
    expect(range.to).toEqual(endOfDay(new Date(2026, 10, 10)));
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(
      differenceInMilliseconds(range.to, range.from) / 86_400_000,
    ).toBeCloseTo(6.999, 2);
    expect(formatDistance(range.to, range.from)).toBe('7 days');
  });
});
