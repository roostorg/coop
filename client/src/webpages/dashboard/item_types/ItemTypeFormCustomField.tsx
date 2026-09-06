import { Button } from '@/coop-ui/Button';
import { Checkbox } from '@/coop-ui/Checkbox';
import { Combobox } from '@/coop-ui/Combobox';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { isContainerType, type ItemTypeKind } from '@roostorg/coop-types';
import { Trash2 } from 'lucide-react';

import { GQLContainerType, GQLScalarType } from '../../../graphql/generated';
import { titleCaseEnumString } from '../../../utils/string';
import {
  getDisplayStringForRole,
  SchemaFieldRoles,
  schemaFieldRolesFieldTypes,
} from './itemTypeUtils';

export type FieldState = {
  // The index is used as the identifier (NB: front-end only! The backend does
  // not have identifiers for individual fields in an item type schema). This is
  // useful because previously, we were depending on the field name to
  // disambiguate between fields, but that led to some confusing behavior when
  // there were multiple empty fields or multiple fields with the same name in
  // the form. This should solve that issue.
  index: number;
  name: string;
  type: GQLScalarType | GQLContainerType;
  role?: SchemaFieldRoles;
  required: boolean;
  container?: {
    containerType: GQLContainerType;
    keyScalarType: GQLScalarType | null;
    valueScalarType: GQLScalarType;
  };
  hidden: boolean;
};

export default function ItemTypeFormCustomField<T extends ItemTypeKind>(props: {
  field: FieldState;
  availableRoles: SchemaFieldRoles[];
  itemTypeKind: T;
  updateFieldState: (prevField: FieldState, newField: FieldState) => void;
  onClickDelete: () => void;
}) {
  const {
    field,
    availableRoles,
    itemTypeKind,
    onClickDelete,
    updateFieldState,
  } = props;

  const fieldTypeSelect = (
    <div className="flex flex-col gap-2">
      <div className="font-semibold">Field Type</div>
      <Combobox
        placeholder="Select field type"
        className="w-36"
        value={field.type ?? undefined}
        disabled={field.role != null}
        allowClear
        onValueChange={(value) => {
          if (value != null) {
            updateFieldState(field, {
              ...field,
              type: value as GQLScalarType | GQLContainerType,
            });
          }
        }}
        options={[
          ...Object.values(GQLScalarType)
            .filter((it) => it !== 'USER_ID') // TODO: Remove this filter when we remove the USER_ID scalar type
            .map((scalar) => ({
              value: scalar,
              label: titleCaseEnumString(scalar).replace('Id', 'ID'),
            })),
          ...Object.values(GQLContainerType).map((container) => ({
            value: container,
            label: titleCaseEnumString(container),
          })),
        ]}
      />
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-end mb-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">Field Name</div>
          <Input
            className="w-36"
            placeholder="Field Name"
            defaultValue={field.name}
            onChange={(event) => {
              updateFieldState(field, { ...field, name: event.target.value });
            }}
          />
        </div>
        <div className="flex flex-col mx-4 gap-2">
          <div className="font-semibold">Role (Optional)</div>
          <Combobox
            className="w-36"
            value={field.role ?? SchemaFieldRoles.NONE}
            allowClear
            onValueChange={(value) => {
              if (value == null || value === SchemaFieldRoles.NONE) {
                updateFieldState(field, { ...field, role: undefined });
                return;
              }
              const role = value as Exclude<
                SchemaFieldRoles,
                SchemaFieldRoles.NONE
              >;
              updateFieldState(field, {
                ...field,
                type: schemaFieldRolesFieldTypes[role],
                role,
              });
            }}
            options={[
              // When we pass the availableRoles value into this component, we
              // only includes roles that have not already been assigned to
              // fields. Because this dropdown menu is just populated by the
              // availableRoles array (see below), that means if this field
              // already has a role assigned, then that role wouldn't show up in
              // the dropdown (because it would've been filtered out of
              // availableRoles). But that would be a weird experience, so if
              // this field's role is set, then we manually add that role as an
              // option in the dropdown.
              ...(field.role
                ? [
                    {
                      value: field.role,
                      label: getDisplayStringForRole(field.role, itemTypeKind),
                    },
                  ]
                : []),
              ...availableRoles
                .sort((a, b) =>
                  a === SchemaFieldRoles.NONE
                    ? -1
                    : b === SchemaFieldRoles.NONE
                      ? 1
                      : a.localeCompare(b),
                )
                .map((it) => ({
                  value: it,
                  label: getDisplayStringForRole(it, itemTypeKind),
                })),
            ]}
          />
        </div>

        <div className="flex items-center mb-2 mr-2 space-x-2">
          <Checkbox
            id="required-checkbox"
            checked={field.required}
            onCheckedChange={(isChecked) =>
              updateFieldState(field, {
                ...field,
                required: isChecked,
              })
            }
          />
          <Label htmlFor="required-checkbox">Required</Label>
        </div>

        <div className="flex items-center mb-2 space-x-2">
          <Checkbox
            id="hidden-checkbox"
            checked={field.hidden}
            onCheckedChange={(isChecked) =>
              updateFieldState(field, {
                ...field,
                hidden: isChecked,
              })
            }
          />
          <Label htmlFor="hidden-checkbox">Hidden Field</Label>
        </div>
        <Button
          variant="ghost"
          color="red"
          size="icon"
          className="self-end ml-2"
          aria-label="Delete field"
          onClick={onClickDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-row gap-4">
        {field.role == null ? (
          fieldTypeSelect
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{fieldTypeSelect}</TooltipTrigger>
            <TooltipContent>
              <div>
                This field must be of type{' '}
                <b>{titleCaseEnumString(field.type).replace('Id', 'ID')}</b>{' '}
                because of its role is set to{' '}
                <b>{getDisplayStringForRole(field.role, itemTypeKind)}.</b>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {isContainerType(field.type) ? (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">
              {field.type === GQLContainerType.Map
                ? 'Key Type'
                : 'Element Type'}
            </div>
            <Combobox
              placeholder={
                field.type === GQLContainerType.Map
                  ? 'Key type'
                  : 'Element type'
              }
              className="w-36"
              allowClear
              value={
                field.type === GQLContainerType.Map
                  ? (field.container?.keyScalarType ?? undefined)
                  : (field.container?.valueScalarType ?? undefined)
              }
              onValueChange={(next) => {
                if (next == null) return;
                const value = next as GQLScalarType;
                updateFieldState(field, {
                  ...field,
                  container: {
                    // Safe cast because of the isContainerType check above
                    containerType: field.type as GQLContainerType,
                    keyScalarType: field.type === 'ARRAY' ? null : value,
                    valueScalarType:
                      field.type === 'ARRAY'
                        ? value
                        : field.container
                          ? field.container.valueScalarType
                          : GQLScalarType.String,
                  },
                });
              }}
              options={Object.values(GQLScalarType).map((scalar) => ({
                value: scalar,
                label: titleCaseEnumString(scalar).replace('Id', 'ID'),
              }))}
            />
          </div>
        ) : null}
        {field.type === GQLContainerType.Map ? (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">Value Type</div>
            <Combobox
              className="w-36"
              placeholder="Value type"
              allowClear
              value={
                field.container?.keyScalarType !== null
                  ? (field.container?.valueScalarType ?? undefined)
                  : undefined
              }
              onValueChange={(next) => {
                if (next == null) return;
                const { container } = field;
                if (container == null) {
                  throw Error(
                    'Should not be able to set the field.container.valueScalarType field if field.container is not set',
                  );
                }

                updateFieldState(field, {
                  ...field,
                  container: {
                    containerType: field.type as GQLContainerType,
                    keyScalarType: container.keyScalarType,
                    valueScalarType: next as GQLScalarType,
                  },
                });
              }}
              options={Object.values(GQLScalarType).map((scalar) => ({
                value: scalar,
                label: titleCaseEnumString(scalar).replace('Id', 'ID'),
              }))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
