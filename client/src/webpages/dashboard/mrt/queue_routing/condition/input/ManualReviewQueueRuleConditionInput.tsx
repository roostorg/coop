import { Combobox } from '@/coop-ui/Combobox';

import { safePick } from '../../../../../../utils/misc';
import {
  JsonOf,
  jsonParse,
  jsonStringify,
} from '../../../../../../utils/typescript-types';
import { SimplifiedConditionInput } from '../../../../rules/rule_form/RuleFormUtils';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import { CoopInput } from '../../../../types/enums';
import { ManualReviewQueueRoutingStaticTextField } from '../../ManualReviewQueueRoutingStaticField';
import { RoutingRuleItemType } from '../../types';

// Lost the per-option tooltip UI in the antd -> coop-ui migration (Combobox
// options are plain {value, label} pairs); folded into the label instead so
// the explanation isn't lost entirely.
const COOP_INPUT_DESCRIPTIONS: Partial<Record<CoopInput, string>> = {
  [CoopInput.ALL_TEXT]:
    "All of the content's text is extracted and " +
    'concatenated together (if there are multiple text fields), ' +
    'and then the resulting string is run through whichever signal ' +
    'you select',
  [CoopInput.ANY_IMAGE]:
    "All of the content's images are extracted and run " +
    'through whichever signal you select. If any one of them ' +
    'matches the signal, this condition will pass.',
  [CoopInput.ANY_VIDEO]:
    "All of the content's videos are extracted and run " +
    'through whichever signal you select. If any one of them ' +
    'matches the signal, this condition will pass.',
  [CoopInput.ANY_GEOHASH]:
    "All of the content's geohashes are extracted and run " +
    'through whichever signal you select. If any one of them ' +
    'matches the signal, this condition will pass.',
  [CoopInput.AUTHOR_USER]:
    'Use this to check inspect the user who created this content, ' +
    'rather than inspecting the content itself.',
  [CoopInput.POLICY_ID]: 'The policy that was used to enqueue this job.',
  [CoopInput.SOURCE]: 'The creation source from which this job was enqueued.',
};

export default function ManualReviewQueueRuleConditionInput(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  eligibleInputs: Map<string, ConditionInput[]>;
  selectedItemTypes: RoutingRuleItemType[];
  editing: boolean;
  onUpdateConditionInput: (input: SimplifiedConditionInput) => void;
}) {
  const {
    condition,
    location,
    eligibleInputs,
    selectedItemTypes,
    editing,
    onUpdateConditionInput,
  } = props;
  const { conditionSetIndex, conditionIndex } = location;

  /**
   * Takes in a GraphQL query response that contains the fields (type, name,
   * contentTypeId, spec), even if some of the values of those fields are null,
   * and strips out the null fields to return a pruned ConditionInput object.
   *
   * Each input option in the dropdown menu needs a unique `value` string. The
   * value can't just be the input's display name, because fields on different
   * content types could share the same name. So we stringify the whole input
   * object as the option's unique identifier.
   */
  const getOptionValue = (input: SimplifiedConditionInput) => {
    // Picking properties explicitly below ensures that, in the new object with
    // the picked properties, the properties will always have been added in the
    // same order (because `safePick` goes in order). This is important because
    // JSON.stringify() will leave the properties in the order that they were
    // added to the object being stringified so, if that order isn't consistent,
    // otherwise-identical objects could produce different string keys. Because
    // we are stringifying an object to set as the <Option /> component's value,
    // and those values are compared using string equality, that won't work.
    return jsonStringify(
      (() => {
        switch (input.type) {
          case 'FULL_ITEM':
            return safePick(input, ['type', 'contentTypeIds']);
          case 'CONTENT_FIELD':
            return safePick(input, ['type', 'name', 'contentTypeId']);
          case 'CONTENT_COOP_INPUT':
            return safePick(input, ['type', 'name']);
          case 'USER_ID':
            return safePick(input, ['type']);
          case 'CONTENT_DERIVED_FIELD':
            return {
              type: 'CONTENT_DERIVED_FIELD' as const,
              spec: safePick(input.spec, ['derivationType', 'source']),
            };
        }
      })(),
    );
  };

  const getDisplayNameFromInput = (
    input: ConditionInput | SimplifiedConditionInput,
  ) => {
    switch (input.type) {
      case 'FULL_ITEM':
        return input.contentTypeIds
          ? selectedItemTypes
              .filter((it) => input.contentTypeIds!.includes(it.id))
              .map((it) => it.name)
              .join(' or ')
          : 'Content';
      case 'USER_ID':
        return 'Author';
      case 'CONTENT_FIELD':
        return input.name;
      // NB: We transform the human readable string here instead of at the
      // source of CoopInput because changing the values themselves would
      // make prior condition results uninterpretable by the UI
      case 'CONTENT_COOP_INPUT': {
        if (input.name === CoopInput.ALL_TEXT) {
          return 'Any text in item';
        }

        return `${input.name} in item`;
      }
      case 'CONTENT_DERIVED_FIELD': {
        return 'name' in input ? input.name : input.spec.derivationType;
      }
    }
  };

  return (
    <div
      className="flex items-center pl-3"
      key={`RuleFormCondition-input-form-item-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
    >
      <div
        key={`RuleFormCondition-input-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="flex flex-col items-start"
      >
        <div className="pb-1 text-sm font-bold whitespace-nowrap">Input</div>
        {editing ? (
          <>
            {eligibleInputs.size === 0 && (
              <div className="pb-1 text-red-600">
                Please select at least one item type first
              </div>
            )}
            <Combobox
              key={`RuleFormCondition-input-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
              placeholder="Select input"
              value={
                condition.input ? getOptionValue(condition.input) : undefined
              }
              onValueChange={(input) => {
                if (input != null) {
                  onUpdateConditionInput(
                    jsonParse(input as JsonOf<SimplifiedConditionInput>),
                  );
                }
              }}
              options={[...eligibleInputs.entries()].flatMap(
                ([groupTitle, inputs]) =>
                  inputs.map((input) => ({
                    value: getOptionValue(input),
                    label: `${groupTitle} · ${getDisplayNameFromInput(input)}`,
                    description:
                      input.type === 'CONTENT_COOP_INPUT'
                        ? COOP_INPUT_DESCRIPTIONS[input.name]
                        : undefined,
                  })),
              )}
            />
          </>
        ) : (
          <ManualReviewQueueRoutingStaticTextField
            text={
              condition.input ? getDisplayNameFromInput(condition.input) : ''
            }
          />
        )}
        <div className="invisible pb-1 text-sm font-bold whitespace-nowrap">
          Input
        </div>
      </div>
    </div>
  );
}
