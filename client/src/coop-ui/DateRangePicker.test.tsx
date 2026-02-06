import React from 'react';

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import { fireEvent, render, screen } from '@testing-library/react';

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
    const onUpdateMock = jest.fn();
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
        from: new Date(2023, 1, 1), // Note: month is 0-indexed
        to: new Date(2023, 2, 30),
      },
    });
  });
});
