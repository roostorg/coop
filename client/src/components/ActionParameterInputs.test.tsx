import { TooltipProvider } from '@/coop-ui/Tooltip';
import {
  GQLActionParameterType,
  type GQLActionParameter,
} from '@/graphql/generated';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import ActionParameterInputs, {
  type ActionParameterValues,
} from './ActionParameterInputs';

const daysParam = {
  __typename: 'ActionParameter',
  name: 'days',
  displayName: 'Days',
  type: GQLActionParameterType.Number,
  required: false,
  options: null,
  description: null,
  defaultValue: null,
  min: 10,
  max: 20,
  maxLength: null,
} as GQLActionParameter;

function Harness(props: { onValues: (v: ActionParameterValues) => void }) {
  const [values, setValues] = useState<ActionParameterValues>({});
  return (
    <TooltipProvider>
      <ActionParameterInputs
        parameters={[daysParam]}
        values={values}
        onChange={(next) => {
          setValues(next);
          props.onValues(next);
        }}
      />
    </TooltipProvider>
  );
}

describe('ActionParameterInputs number fields', () => {
  it('keeps an in-progress value below min and clamps it on blur', () => {
    const onValues = vi.fn();
    render(<Harness onValues={onValues} />);
    const input = screen.getByLabelText(/Days/);

    // Typing "1" on the way to "15" must not jump straight to the min.
    fireEvent.change(input, { target: { value: '1' } });
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: '15' } });
    expect(input).toHaveValue(15);

    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(input).toHaveValue(20);
    expect(onValues).toHaveBeenLastCalledWith({ days: 20 });
  });
});
