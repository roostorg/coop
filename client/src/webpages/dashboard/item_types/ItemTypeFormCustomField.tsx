import { Checkbox } from '@/coop-ui/Checkbox';
import { Label } from '@/coop-ui/Label';
import { DeleteOutlined } from '@ant-design/icons';
import { isContainerType, type ItemTypeKind } from '@roostorg/types';
import { Button, Input, Select, Tooltip } from 'antd';

import { selectFilterByLabelOption } from '../components/antDesignUtils';

import { GQLContainerType, GQLScalarType } from '../../../graphql/generated';
import { titleCaseEnumString } from '../../../utils/string';
import {
  getDisplayStringForRole,
  SchemaFieldRoles,
  schemaFieldRolesFieldTypes,
} from './itemTypeUtils';

const { Option } = Select;

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
      <Select
        placeholder="Select field type"
        dropdownMatchSelectWidth={false}
        className="w-36"
        value={field.type ?? undefined}
        disabled={field.role != null}
        allowClear
        showSearch
        filterOption={selectFilterByLabelOption}
        onSelect={(value) => updateFieldState(field, { ...field, type: value })}
      >
        {Object.values(GQLScalarType)
          .filter((it) => it !== 'USER_ID') // TODO: Remove this filter when we remove the USER_ID scalar type
          .map((scalar) => (
            <Option
              key={scalar}
              value={scalar}
              label={titleCaseEnumString(scalar).replace('Id', 'ID')}
            >
              {titleCaseEnumString(scalar).replace('Id', 'ID')}
            </Option>
          ))}
        {Object.values(GQLContainerType).map((container) => (
          <Option
            key={container}
            value={container}
            label={titleCaseEnumString(container)}
          >
            {titleCaseEnumString(container)}
          </Option>
        ))}
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-end mb-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">Field Name</div>
          <Input
            className="rounded-lg w-36"
            placeholder="Field Name"
            defaultValue={field.name}
            onChange={(event) => {
              updateFieldState(field, { ...field, name: event.target.value });
            }}
          />
        </div>
        <div className="flex flex-col mx-4 gap-2">
          <div className="font-semibold">Role (Optional)</div>
          <Select<SchemaFieldRoles>
            dropdownMatchSelectWidth={false}
            className="w-36"
            defaultValue={SchemaFieldRoles.NONE}
            value={field.role ?? SchemaFieldRoles.NONE}
            allowClear
            showSearch
            filterOption={selectFilterByLabelOption}
            onSelect={(value) =>
              value === SchemaFieldRoles.NONE
                ? updateFieldState(field, { ...field, role: undefined })
                : updateFieldState(field, {
                    ...field,
                    type: schemaFieldRolesFieldTypes[value],
                    role: value,
                  })
            }
          >
            {field.role && (
              <Option
                key={field.role}
                value={field.role}
                label={getDisplayStringForRole(field.role, itemTypeKind)}
              >
                {getDisplayStringForRole(field.role, itemTypeKind)}
              </Option>
            )}
            {
              // When we pass the availableRoles value into this component, we
              // only includes roles that have not already been assigned to
              // fields. Because this dropdown menu is just populated by the
              // availableRoles array (see below), that means if this field
              // already has a role assigned, then that role wouldn't show up in
              // the dropdown (because it would've been filtered out of
              // availableRoles). But that would be a weird experience, so if
              // this field's role is set, then we manually add that role as an
              // option in the dropdown.
              availableRoles
                .sort((a, b) =>
                  a === SchemaFieldRoles.NONE
                    ? -1
                    : b === SchemaFieldRoles.NONE
                    ? 1
                    : a.localeCompare(b),
                )
                .map((it) => (
                  <Option
                    key={it}
                    value={it}
                    label={getDisplayStringForRole(it, itemTypeKind)}
                  >
                    {getDisplayStringForRole(it, itemTypeKind)}
                  </Option>
                ))
            }
          </Select>
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
          className="self-end ml-2 text-red-500 border-none"
          icon={<DeleteOutlined />}
          onClick={onClickDelete}
        />
      </div>
      <div className="flex flex-row gap-4">
        {field.role == null ? (
          fieldTypeSelect
        ) : (
          <Tooltip
            title={
              <div>
                This field must be of type{' '}
                <b>{titleCaseEnumString(field.type).replace('Id', 'ID')}</b>{' '}
                because of its role is set to{' '}
                <b>{getDisplayStringForRole(field.role, itemTypeKind)}.</b>
              </div>
            }
          >
            {fieldTypeSelect}
          </Tooltip>
        )}
        {isContainerType(field.type) ? (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">
              {field.type === GQLContainerType.Map
                ? 'Key Type'
                : 'Element Type'}
            </div>
            <Select
              placeholder={
                field.type === GQLContainerType.Map
                  ? 'Key type'
                  : 'Element type'
              }
              className="w-36"
              dropdownMatchSelectWidth={false}
              allowClear
              showSearch
              filterOption={selectFilterByLabelOption}
              value={
                field.type === GQLContainerType.Map
                  ? field.container?.keyScalarType ?? undefined
                  : field.container?.valueScalarType ?? undefined
              }
              onSelect={(value) =>
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
                })
              }
            >
              {Object.values(GQLScalarType).map((scalar, i) => (
                <Option
                  key={i}
                  value={scalar}
                  label={titleCaseEnumString(scalar).replace('Id', 'ID')}
                >
                  {titleCaseEnumString(scalar).replace('Id', 'ID')}
                </Option>
              ))}
            </Select>
          </div>
        ) : null}
        {field.type === GQLContainerType.Map ? (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">Value Type</div>
            <Select
              className="w-36"
              placeholder="Value type"
              dropdownMatchSelectWidth={false}
              allowClear
              showSearch
              filterOption={selectFilterByLabelOption}
              value={
                field.container?.keyScalarType !== null
                  ? field.container?.valueScalarType ?? undefined
                  : undefined
              }
              onSelect={(value) => {
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
                    valueScalarType: value,
                  },
                });
              }}
            >
              {Object.values(GQLScalarType).map((scalar, i) => (
                <Option
                  key={i}
                  value={scalar}
                  label={titleCaseEnumString(scalar).replace('Id', 'ID')}
                >
                  {titleCaseEnumString(scalar).replace('Id', 'ID')}
                </Option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
