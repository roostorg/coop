import CoopSelect from '../../../../../../components/common/CoopSelect';

import { GQLNcmecFileAnnotation } from '../../../../../../graphql/generated';
import { titleCaseEnumString } from '../../../../../../utils/string';

export default function NCMECLabelSelector(props: {
  disabled: boolean;
  value: GQLNcmecFileAnnotation[] | undefined;
  addLabel: (label: GQLNcmecFileAnnotation) => void;
  removeLabel: (label: GQLNcmecFileAnnotation) => void;
  setIsOpen?: (open: boolean) => void;
}) {
  const { disabled, value, addLabel, removeLabel, setIsOpen } = props;

  return (
    <CoopSelect
      options={Object.values(GQLNcmecFileAnnotation).map((option) => ({
        value: option,
        label: titleCaseEnumString(option),
      }))}
      mode="multiselect"
      placeholder="Select one or more labels"
      disabled={disabled}
      value={value}
      onSelect={addLabel}
      onDeselect={removeLabel}
      onDropdownVisibleChange={(visible) => setIsOpen && setIsOpen(visible)}
      openDropdownKeyBinding="i"
    />
  );
}
