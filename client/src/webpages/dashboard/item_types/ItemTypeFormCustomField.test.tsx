import { ItemTypeKind } from '@roostorg/coop-types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import { GQLContainerType, GQLScalarType } from '../../../graphql/generated';
import ItemTypeFormCustomField, {
  type FieldState,
} from './ItemTypeFormCustomField';
import { SchemaFieldRoles } from './itemTypeUtils';

const baseField: FieldState = {
  index: 0,
  name: 'body',
  type: GQLScalarType.String,
  required: false,
  hidden: false,
  persisted: false,
  originallyRequired: false,
  addedToExistingItemType: false,
};

function renderTwoFields(
  updateFieldState: (prev: FieldState, next: FieldState) => void,
) {
  return render(
    <>
      {[0, 1].map((index) => (
        <ItemTypeFormCustomField
          key={index}
          field={{ ...baseField, index, name: `field${index}` }}
          availableRoles={[]}
          itemTypeKind={ItemTypeKind.CONTENT}
          updateFieldState={updateFieldState}
          onClickDelete={vi.fn()}
        />
      ))}
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

    fireEvent.click(screen.getAllByText('Required')[1]);

    expect(updateFieldState).toHaveBeenCalledTimes(1);
    const [prevField, newField] = updateFieldState.mock.calls[0];
    expect(prevField.index).toBe(1);
    expect(newField.required).toBe(true);
  });
});

function renderField(
  field: FieldState,
  availableRoles = [SchemaFieldRoles.NONE, SchemaFieldRoles.DISPLAY_NAME],
) {
  const updateFieldState = vi.fn();
  render(
    <ItemTypeFormCustomField
      field={field}
      availableRoles={availableRoles}
      itemTypeKind={ItemTypeKind.CONTENT}
      updateFieldState={updateFieldState}
      onClickDelete={vi.fn()}
    />,
  );

  const selects = screen.getAllByRole('combobox');
  return {
    updateFieldState,
    role: selects[0],
    fieldType: selects[1],
    deleteButton: screen.getByRole('button'),
    required: screen.getByRole('checkbox', { name: 'Required' }),
    hidden: screen.getByRole('checkbox', { name: 'Hidden Field' }),
    name: screen.getByPlaceholderText('Field Name'),
    selects,
  };
}

describe('ItemTypeFormCustomField editability', () => {
  it.each([
    {
      name: 'persisted required field',
      field: { persisted: true, originallyRequired: true, required: true },
      requiredDisabled: false,
    },
    {
      name: 'persisted optional field',
      field: { persisted: true, originallyRequired: false, required: false },
      requiredDisabled: true,
    },
  ])('locks schema controls for a $name', ({ field, requiredDisabled }) => {
    const controls = renderField({ ...baseField, ...field });

    expect(controls.name).toBeDisabled();
    expect(controls.fieldType).toBeDisabled();
    expect(controls.deleteButton).toBeDisabled();
    expect(controls.required).toHaveProperty('disabled', requiredDisabled);
    expect(controls.role).toBeEnabled();
    expect(controls.hidden).toBeEnabled();
  });

  it('allows a persisted required field to be relaxed', () => {
    const field = {
      ...baseField,
      persisted: true,
      originallyRequired: true,
      required: true,
    };
    const { required, updateFieldState } = renderField(field);

    required.click();

    expect(updateFieldState).toHaveBeenCalledWith(field, {
      ...field,
      required: false,
    });
  });

  it('keeps a new field on an existing type editable except for required', () => {
    const controls = renderField({
      ...baseField,
      addedToExistingItemType: true,
    });

    expect(controls.name).toBeEnabled();
    expect(controls.fieldType).toBeEnabled();
    expect(controls.deleteButton).toBeEnabled();
    expect(controls.required).toBeDisabled();
    expect(controls.role).toBeEnabled();
    expect(controls.hidden).toBeEnabled();
  });

  it('keeps fields on a new type fully editable', () => {
    const controls = renderField(baseField);

    expect(controls.name).toBeEnabled();
    expect(controls.fieldType).toBeEnabled();
    expect(controls.deleteButton).toBeEnabled();
    expect(controls.required).toBeEnabled();
    expect(controls.role).toBeEnabled();
    expect(controls.hidden).toBeEnabled();
  });

  it('locks all container controls for a persisted field', async () => {
    const controls = renderField({
      ...baseField,
      type: GQLContainerType.Map,
      container: {
        containerType: GQLContainerType.Map,
        keyScalarType: GQLScalarType.String,
        valueScalarType: GQLScalarType.String,
      },
      persisted: true,
    });

    expect(controls.selects).toHaveLength(4);
    expect(controls.selects[1]).toBeDisabled();
    expect(controls.selects[2]).toBeDisabled();
    expect(controls.selects[3]).toBeDisabled();
    expect(controls.role).toBeEnabled();

    fireEvent.mouseEnter(screen.getByText('Key Type').parentElement!);
    expect(
      await screen.findByText('Saved field names and types cannot be changed.'),
    ).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText('Key Type').parentElement!);
    fireEvent.mouseEnter(screen.getByText('Value Type').parentElement!);
    expect(
      await screen.findByText('Saved field names and types cannot be changed.'),
    ).toBeInTheDocument();
  });

  it('only offers type-compatible roles for a persisted field', () => {
    const field = { ...baseField, persisted: true };
    const { role, hidden, updateFieldState } = renderField(field, [
      SchemaFieldRoles.NONE,
      SchemaFieldRoles.CREATED_AT,
      SchemaFieldRoles.DISPLAY_NAME,
    ]);

    expect(role).toBeEnabled();
    expect(hidden).toBeEnabled();

    fireEvent.mouseDown(role);
    const roleList = screen.getByRole('listbox');
    expect(
      within(roleList).queryByRole('option', { name: 'Created At' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Title').at(-1)!);

    expect(updateFieldState).toHaveBeenCalledWith(field, {
      ...field,
      type: GQLScalarType.String,
      role: SchemaFieldRoles.DISPLAY_NAME,
    });
  });
});
