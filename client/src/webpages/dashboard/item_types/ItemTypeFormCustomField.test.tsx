import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom/extend-expect';

import { ItemTypeKind } from '@roostorg/coop-types';
import { vi } from 'vitest';

import { GQLScalarType } from '../../../graphql/generated';
import ItemTypeFormCustomField, {
  type FieldState,
} from './ItemTypeFormCustomField';

function makeField(index: number): FieldState {
  return {
    index,
    name: `field${index}`,
    type: GQLScalarType.String,
    required: false,
    hidden: false,
  };
}

function renderTwoFields(
  updateFieldState: (prev: FieldState, next: FieldState) => void,
) {
  return render(
    <>
      <ItemTypeFormCustomField
        field={makeField(0)}
        availableRoles={[]}
        itemTypeKind={ItemTypeKind.CONTENT}
        updateFieldState={updateFieldState}
        onClickDelete={vi.fn()}
      />
      <ItemTypeFormCustomField
        field={makeField(1)}
        availableRoles={[]}
        itemTypeKind={ItemTypeKind.CONTENT}
        updateFieldState={updateFieldState}
        onClickDelete={vi.fn()}
      />
    </>,
  );
}

describe('ItemTypeFormCustomField', () => {
  it('gives each field row unique Required/Hidden checkbox ids', () => {
    renderTwoFields(vi.fn());

    const requiredFors = screen
      .getAllByText('Required')
      .map((label) => label.getAttribute('for'));
    const hiddenFors = screen
      .getAllByText('Hidden Field')
      .map((label) => label.getAttribute('for'));

    expect(new Set(requiredFors).size).toBe(2);
    expect(new Set(hiddenFors).size).toBe(2);
    expect(requiredFors.every(Boolean)).toBe(true);
    expect(hiddenFors.every(Boolean)).toBe(true);
  });

  it("does not cross-trigger a different field's checkbox when clicking a label", () => {
    const updateFieldState = vi.fn();
    renderTwoFields(updateFieldState);

    const secondRequiredLabel = screen.getAllByText('Required')[1];
    fireEvent.click(secondRequiredLabel);

    expect(updateFieldState).toHaveBeenCalledTimes(1);
    const [prevField, newField] = updateFieldState.mock.calls[0];
    expect(prevField.index).toBe(1);
    expect(newField.required).toBe(true);
  });
});
