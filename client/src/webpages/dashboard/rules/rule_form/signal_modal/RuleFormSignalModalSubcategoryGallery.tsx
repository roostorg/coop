import { SearchOutlined } from '@ant-design/icons';
import { Button, Input, Radio, Select } from 'antd';
import omit from 'lodash/omit';
import { useState } from 'react';

import { GQLSignal, GQLSignalSubcategory } from '@/graphql/generated';
import { rebuildSubcategoryTreeFromGraphQLResponse } from '../../../../../utils/signalUtils';
import RuleFormSignalModalNoSearchResults from './RuleFormSignalModalNoSearchResults';
import { RuleFormSignalModalSubcategory } from './RuleFormSignalModalSubcategory';

type Mode = 'policy' | 'free_text';

function initialMode(signal: CoreSignal): Mode {
  if (signal.subcategory?.startsWith('policy:')) return 'policy';
  return 'free_text';
}

export function RuleFormSignalModalSubcategoryGallery(props: {
  signal: GQLSignal;
  subcategories: readonly GQLSignalSubcategory[];
  onSelectSubcategoryOption: (option: string) => void;
}) {
  const { signal, subcategories, onSelectSubcategoryOption } = props;
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [freeText, setFreeText] = useState<string>(
    signal.subcategory && !signal.subcategory.startsWith('policy:')
      ? signal.subcategory
      : '',
  );

  const stripped = subcategories.map((subcategory) =>
    omit(subcategory, '__typename'),
  );

  const hasTreeStructure = stripped.some((s) => s.childrenIds.length > 0);

  // Sentinel for free-text criteria entry.
  const hasFreeTextSentinel = stripped.some((s) => s.id === '__free_text__');
  // Policy options are any subcategory whose id begins with "policy:".
  const policyOptions = stripped.filter((s) => s.id.startsWith('policy:'));
  const hasPolicyOptions = policyOptions.length > 0;

  // Mixed mode: org has policies AND free-text entry, show a toggle.
  const isMixed = hasFreeTextSentinel && hasPolicyOptions;

  const [mode, setMode] = useState<Mode>(initialMode(signal));

  if (isMixed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="pb-1 text-2xl font-medium">Select Policy Criteria</div>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <Radio.Button value="policy">Existing Policy</Radio.Button>
          <Radio.Button value="free_text">Custom Text</Radio.Button>
        </Radio.Group>

        {mode === 'policy' && (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-gray-500">
              Select a policy — its text will be used as the classifier
              criteria.
            </div>
            <Select
              className="max-w-xs"
              placeholder="Select a policy"
              defaultValue={
                signal.subcategory?.startsWith('policy:')
                  ? signal.subcategory
                  : undefined
              }
              onChange={(value: string) => onSelectSubcategoryOption(value)}
              options={policyOptions.map((s) => ({
                value: s.id,
                label: s.label,
              }))}
            />
          </div>
        )}

        {mode === 'free_text' && (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-gray-500">
              Describe the policy the model should evaluate content against.
            </div>
            <Input.TextArea
              rows={6}
              className="max-w-lg"
              placeholder="e.g. The content contains hate speech targeting a protected group."
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
            />
            <div>
              <Button
                type="primary"
                disabled={!freeText.trim()}
                onClick={() => onSelectSubcategoryOption(freeText.trim())}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Only the free-text sentinel (no policies configured yet).
  if (!hasTreeStructure && hasFreeTextSentinel) {
    return (
      <div className="flex flex-col gap-3">
        <div className="pb-1 text-2xl font-medium">Enter Policy Criteria</div>
        <div className="text-sm text-gray-500">
          Describe the policy the model should evaluate content against.
        </div>
        <Input.TextArea
          rows={6}
          className="max-w-lg"
          placeholder="e.g. The content contains hate speech targeting a protected group."
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
        />
        <div>
          <Button
            type="primary"
            disabled={!freeText.trim()}
            onClick={() => onSelectSubcategoryOption(freeText.trim())}
          >
            Confirm
          </Button>
        </div>
      </div>
    );
  }

  if (!hasTreeStructure && stripped.length > 0) {
    // Render a simple dropdown for flat subcategories (e.g. Zentropi labeler versions)
    return (
      <div className="flex flex-col">
        <div className="pb-3 text-2xl font-medium">Select Subcategory</div>
        <Select
          className="max-w-xs"
          placeholder="Select a labeler version"
          onChange={(value: string) => onSelectSubcategoryOption(value)}
          options={stripped.map((s) => ({
            value: s.id,
            label: s.label,
          }))}
        />
      </div>
    );
  }

  // Hive subcategories are snake_case, but we display them like this: "Snake Case".
  // So we need to allow a search term like "snake case" match against the subcategory
  // "snake_case". To do this, we add a snake case search term.
  const snakeCaseSearchTerm = searchTerm.replaceAll('_', ' ');
  const eligibleSubcategories = rebuildSubcategoryTreeFromGraphQLResponse(
    stripped,
  )
    // First filter out subcategories that don't include the search term.

    .filter(
      (subcategory) =>
        subcategory.id.includes(searchTerm) ||
        subcategory.id.includes(snakeCaseSearchTerm) ||
        subcategory.label.includes(searchTerm) ||
        subcategory.label.includes(snakeCaseSearchTerm) ||
        (subcategory.description &&
          (subcategory.description.includes(searchTerm) ||
            subcategory.description.includes(snakeCaseSearchTerm))),
    );

  return (
    <div className="flex flex-col">
      <div className="pb-3 text-2xl font-medium">Select Subcategory</div>
      <Input
        className="max-w-xs mb-2 rounded-lg"
        placeholder="Search"
        prefix={<SearchOutlined className="site-form-item-icon" />}
        allowClear
        onChange={(event) =>
          setSearchTerm(event.target.value.toLocaleLowerCase())
        }
      />
      {eligibleSubcategories.map((subcategory) => (
        <RuleFormSignalModalSubcategory
          key={subcategory.id}
          subcategory={subcategory}
          onSelectSubcategoryOption={onSelectSubcategoryOption}
        />
      ))}
      {eligibleSubcategories.length === 0 && (
        <RuleFormSignalModalNoSearchResults />
      )}
    </div>
  );
}
