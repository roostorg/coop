import {
  useGQLItemTypesQuery,
  useGQLRuleQuery,
  useGQLSpotTestRuleLazyQuery,
  type GQLFieldType,
  type GQLScalarType,
} from '@/graphql/generated';
import { assertUnreachable } from '@/utils/misc';
import { gql } from '@apollo/client';
import { Select } from 'antd';
import Input from 'antd/lib/input/Input';
import { useEffect, useState } from 'react';

import CoopModal from '../../components/CoopModal';
import ComponentLoading from '@/components/common/ComponentLoading';

import type { ConditionSetWithResult } from '../types';
import {
  SAMPLE_RULE_EXECUTION_RESULT_CONDITION_RESULT_FIELDS,
  SAMPLE_RULE_EXECUTION_RESULT_FIELDS,
} from './insights/RuleInsightsSamplesTable';
import { RuleInsightsSampleDetailResultsImpl } from './insights/sample_details/RuleInsightsSampleDetailResults';

const { Option } = Select;

gql`
  ${SAMPLE_RULE_EXECUTION_RESULT_FIELDS}
  ${SAMPLE_RULE_EXECUTION_RESULT_CONDITION_RESULT_FIELDS}
  query SpotTestRule($ruleId: ID!, $item: SpotTestItemInput!) {
    spotTestRule(ruleId: $ruleId, item: $item) {
      ... on RuleExecutionResult {
        ...SampleRuleExecutionResultFields
        result {
          ...SampleRuleExecutionResultConditionResultFields
        }
      }
    }
  }
`;

export const spotTestForbiddenFieldTypes = [
  'MAP',
  'DATETIME',
  'RELATED_ITEM',
  'POLICY_ID',
] satisfies GQLFieldType[] as GQLFieldType[];

export default function RuleTestModal(props: {
  ruleId: string;
  onClose: () => void;
}) {
  const { ruleId, onClose } = props;
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<
    string | undefined
  >(undefined);
  const [testData, setTestData] = useState<Record<string, string | string[]>>(
    {},
  );
  const [result, setResult] = useState<ConditionSetWithResult | undefined>(
    undefined,
  );

  const {
    data: ruleData,
    loading: ruleLoading,
    error: ruleError,
  } = useGQLRuleQuery({
    variables: { id: ruleId },
  });

  const {
    data: itemTypesData,
    loading: itemTypesLoading,
    error: itemTypesError,
  } = useGQLItemTypesQuery();

  const [
    spotTestRule,
    { data: spotTestData, loading: spotTestLoading, error: spotTestError },
  ] = useGQLSpotTestRuleLazyQuery();

  const rule = ruleData?.rule;

  useEffect(() => {
    if (rule && rule.__typename === 'ContentRule') {
      setSelectedItemTypeId(rule.itemTypes?.[0].id);
    }
  }, [rule]);

  useEffect(() => {
    if (spotTestData) {
      setResult(
        spotTestData.spotTestRule.result as unknown as ConditionSetWithResult,
      );
    }
  }, [spotTestData]);

  if (ruleLoading || itemTypesLoading) {
    return <ComponentLoading />;
  }

  if (
    ruleError ||
    itemTypesError ||
    rule == null ||
    rule.__typename === 'UserRule'
  ) {
    return <div>Error: could not load rule testing form</div>;
  }

  const selectedItemType = itemTypesData?.myOrg?.itemTypes?.find(
    (itemType) => itemType.id === selectedItemTypeId,
  );

  const getPlaceholder = (
    fieldType: GQLFieldType,
    containerValueScalarType: GQLScalarType | undefined,
  ): string => {
    switch (fieldType) {
      case 'AUDIO':
        return 'https://test.com/audio.mp3';
      case 'BOOLEAN':
        return 'false';
      case 'GEOHASH':
        return '9q8yy';
      case 'ID':
      case 'NUMBER':
        return '123';
      case 'IMAGE':
        return 'https://test.com/image.jpg';
      case 'VIDEO':
        return 'https://test.com/video.mp4';
      case 'STRING':
        return 'Some text...';
      case 'URL':
        return 'https://test.com';
      case 'USER_ID':
        return 'user-id';
      case 'ARRAY':
        return `${getPlaceholder(
          containerValueScalarType!,
          undefined,
        )}, ${getPlaceholder(containerValueScalarType!, undefined)}`;
      case 'MAP':
      case 'DATETIME':
      case 'RELATED_ITEM':
      case 'POLICY_ID':
        throw new Error('Unsupported field type');
      default:
        assertUnreachable(fieldType);
    }
  };

  return (
    <CoopModal
      title={`Test Rule: ${rule.name}`}
      visible={true}
      onClose={onClose}
      footer={[
        {
          title: 'Test Rule',
          type: 'primary',
          onClick: () => {
            if (selectedItemType) {
              spotTestRule({
                variables: {
                  ruleId,
                  item: {
                    itemTypeIdentifier: {
                      id: selectedItemType.id,
                      version: selectedItemType.version,
                      schemaVariant: 'ORIGINAL' as const,
                    },
                    data: testData,
                  },
                },
              });
            }
          },
          loading: spotTestLoading,
          disabled: selectedItemType?.baseFields?.some(
            (it) =>
              !spotTestForbiddenFieldTypes.includes(it.type) &&
              it.required &&
              !testData[it.name],
          ),
        },
      ]}
    >
      <div className="flex flex-col w-full gap-4">
        {selectedItemType ? (
          <div className="font-medium text-gray-500">
            Fill in the fields below to test the rule with sample data
          </div>
        ) : null}
        <div className="flex flex-row items-center gap-2">
          Item Type:
          <Select<string>
            placeholder="Select Item Type"
            dropdownMatchSelectWidth={false}
            onChange={(value) => {
              setSelectedItemTypeId(value);
              setResult(undefined);
            }}
            value={selectedItemTypeId}
          >
            {rule.itemTypes?.map((itemType) => (
              <Option
                key={itemType.id}
                value={itemType.id}
                label={itemType.name}
              >
                {itemType.name}
              </Option>
            ))}
          </Select>
        </div>
        {selectedItemType?.baseFields
          ?.filter((field) => !spotTestForbiddenFieldTypes.includes(field.type))
          .map((field) => (
            <div key={field.name} className="flex flex-col">
              <label className="pb-2 w-fit">
                {field.name}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <Input
                placeholder={getPlaceholder(
                  field.type,
                  field.container?.valueScalarType,
                )}
                onChange={(e) => {
                  const value =
                    field.type === 'ARRAY'
                      ? e.target.value.includes(',')
                        ? e.target.value.split(',').map((item) => item.trim())
                        : [e.target.value]
                      : e.target.value;

                  setTestData({
                    ...testData,
                    [field.name]: value,
                  });
                }}
              />
            </div>
          ))}
      </div>
      {spotTestError ? (
        <div className="text-red-500">{spotTestError.message}</div>
      ) : result ? (
        <div className="flex flex-col">
          <div className="my-8 divider" />
          <div className="mb-2 text-xl font-bold">Result</div>
          <RuleInsightsSampleDetailResultsImpl
            itemTypes={itemTypesData?.myOrg?.itemTypes ?? []}
            conditionSetWithResult={result}
            loading={spotTestLoading}
          />
        </div>
      ) : undefined}
    </CoopModal>
  );
}
