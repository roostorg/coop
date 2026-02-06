import { Form, Select } from 'antd';

import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';

import { CoreSignal } from '../../../../../../models/signal';
import { safePick } from '../../../../../../utils/misc';
import {
  jsonParse,
  jsonStringify,
} from '../../../../../../utils/typescript-types';
import { CoopInput } from '../../../../types/enums';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../types';
import { optionWithTooltip } from '../../RuleFormCondition';
import { RuleFormConfigResponse } from '../../RuleFormReducers';
import { SimplifiedConditionInput } from '../../RuleFormUtils';

const { OptGroup } = Select;

const COOP_INPUT_DESCRIPTIONS = {
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
  [CoopInput.SOURCE]: 'The source from which this job was enqueued.',
};

export default function RuleFormConditionInput(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  eligibleInputs: Map<string, ConditionInput[]>;
  selectedItemTypes: RuleFormConfigResponse['itemTypes'];
  allSignals: RuleFormConfigResponse['signals'];
  onUpdateInput: (
    input: SimplifiedConditionInput,
    allSignals: readonly CoreSignal[],
  ) => void;
}) {
  const {
    condition,
    location,
    eligibleInputs,
    selectedItemTypes,
    allSignals,
    onUpdateInput,
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

  const getDisplayNameFromInput = (input: ConditionInput) => {
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
      // NB: We transform the human readable string here instead of at the
      // source of CoopInput because changing the values themselves would
      // make prior condition results uninterpretable by the UI
      case 'CONTENT_COOP_INPUT': {
        if (input.name === CoopInput.ALL_TEXT) {
          return 'Any text in item';
        }

        return `${input.name} in item`;
      }
      case 'CONTENT_FIELD':
      case 'CONTENT_DERIVED_FIELD':
        return input.name;
    }
  };

  return (
    <div
      className="flex items-center"
      key={`RuleFormCondition-input-form-item-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
    >
      <Form.Item
        key={`RuleFormCondition-input-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="!mb-0 !pl-4 !align-middle"
        name={[conditionSetIndex, conditionIndex, 'input']}
      >
        {/* Needs to be wrapped in a div for the state to work properly */}
        <div
          key={`RuleFormCondition-input-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          className="flex flex-col items-start"
        >
          <div className="pb-1 text-xs font-bold">Input</div>
          <Select
            key={`RuleFormCondition-input-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
            placeholder="Select input"
            value={condition.input ? getOptionValue(condition.input) : null}
            allowClear
            showSearch
            filterOption={selectFilterByLabelOption}
            onSelect={(input: ReturnType<typeof getOptionValue>) =>
              onUpdateInput(
                jsonParse(input),
                allSignals satisfies readonly CoreSignal[],
              )
            }
            optionLabelProp="label"
            dropdownMatchSelectWidth={false}
            dropdownRender={(menu) => {
              if (eligibleInputs.size > 0) {
                return menu;
              }
              return (
                <div className="p-2">
                  <div className="text-coop-alert-red">
                    Please select at least one content type first
                  </div>
                  {menu}
                </div>
              );
            }}
          >
            {[...eligibleInputs.entries()].map(([groupTitle, inputs]) => (
              <OptGroup
                key={`RuleFormCondition-input-opt-group_set_index_${String(
                  conditionSetIndex,
                )}_index_${conditionIndex}_${groupTitle}`}
                label={groupTitle}
              >
                {inputs.map((input, index) => {
                  return optionWithTooltip(
                    getDisplayNameFromInput(input),
                    getOptionValue(input),
                    false, // disabled
                    input.type === 'CONTENT_COOP_INPUT'
                      ? COOP_INPUT_DESCRIPTIONS[input.name]
                      : undefined,
                    `RuleFormCondition-input-opt_set_index_${conditionSetIndex}_index_${conditionIndex}_${groupTitle}_${index}`,
                    index,
                  );
                })}
              </OptGroup>
            ))}
          </Select>
          <div className="invisible pb-1 text-xs font-bold">Input</div>
        </div>
      </Form.Item>
    </div>
  );
}
