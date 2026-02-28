import { useGQLIsDemoOrgQuery } from '@/graphql/generated';
import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { useMemo, useState } from 'react';

import { CoreSignal } from '../../../../../models/signal';
import {
  type IntegrationConfig,
  INTEGRATION_CONFIGS,
} from '../../../integrations/integrationConfigs';
import RuleFormSignalModalMenuItem from './RuleFormSignalModalMenuItem';
import RuleFormSignalModalNoSearchResults from './RuleFormSignalModalNoSearchResults';

export default function RuleFormSignalModalSignalGallery(props: {
  allSignals: CoreSignal[];
  onSelectSignal: (signal: CoreSignal) => void;
  onSignalInfoSelected: (signal: CoreSignal) => void;
  isAutomatedRule?: boolean;
}) {
  const { allSignals, onSelectSignal, onSignalInfoSelected, isAutomatedRule } = props;
  const { data: isDemoOrgData } = useGQLIsDemoOrgQuery();
  const isDemoOrg = isDemoOrgData?.myOrg?.isDemoOrg ?? false;

  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredSignals = useMemo(
    () =>
      allSignals
        // Show built-in Coop signals (no integration), known integrations (in INTEGRATION_CONFIGS), or plugin integrations (any other string)
        .filter((signal) =>
          signal.integration === null ||
          INTEGRATION_CONFIGS.some(
            (config: IntegrationConfig) =>
              signal.integration === config.name,
          ) ||
          (typeof signal.integration === 'string' &&
            signal.integration.length > 0),
        )
        // Then filter out the text similarity score signals
        .filter((it) => it.type !== 'TEXT_SIMILARITY_SCORE')
        // Then filter out based on search term
        .filter(
          (signal) =>
            signal.name.toLocaleLowerCase().includes(searchTerm) ||
            signal.description.toLocaleLowerCase().includes(searchTerm),
        )
        // Filter out 3rd party signals for demo orgs
        .filter((signal) => !(isDemoOrg && signal.integration)),
    [allSignals, isDemoOrg, searchTerm],
  );

  return (
    <div className="flex flex-col mb-10">
      <div className="flex justify-start items-center pb-8 absolute top-8 pl-[18px]">
        <Input
          className="max-w-xs rounded-lg"
          placeholder="Search"
          prefix={<SearchOutlined className="site-form-item-icon" />}
          allowClear
          onChange={(event) =>
            setSearchTerm(event.target.value.toLocaleLowerCase())
          }
        />
      </div>
      {filteredSignals?.length ? (
        <div className="grid grid-cols-3 max-h-[75vh] gap-4 overflow-scroll px-5 py-2">
          {[...filteredSignals]
            .map((signal) => {
              // Override disabledInfo if signal is restricted for automated rules
              const effectiveDisabledInfo = 
                isAutomatedRule && !signal.allowedInAutomatedRules
                  ? {
                      __typename: 'DisabledInfo' as const,
                      disabled: true,
                      disabledMessage: 'This signal can only be used in routing rules, not in automated rules with actions.',
                    }
                  : signal.disabledInfo;
              
              return {
                signal,
                effectiveDisabledInfo,
              };
            })
            .sort((a, b) =>
              a.effectiveDisabledInfo.disabled && !b.effectiveDisabledInfo.disabled
                ? 1
                : !a.effectiveDisabledInfo.disabled && b.effectiveDisabledInfo.disabled
                ? -1
                : `${a.signal.integration}_${a.signal.name}`.localeCompare(
                    `${b.signal.integration}_${b.signal.name}`,
                  ),
            )
            .map(({ signal, effectiveDisabledInfo }) => {
              const staticConfig = INTEGRATION_CONFIGS.find(
                (it: IntegrationConfig) => it.name === signal.integration,
              );
              // Signals use the logo-with-background variant.
              const rawPath =
                signal.integrationLogoWithBackgroundUrl ??
                staticConfig?.logoWithBackground ??
                undefined;
              const imagePath =
                typeof rawPath === 'string' && rawPath.startsWith('/')
                  ? `${window.location.origin}${rawPath}`
                  : rawPath;
              return (
                <div key={signal.name}>
                  <RuleFormSignalModalMenuItem
                    key={signal.id}
                    signal={signal}
                    imagePath={imagePath}
                    onClick={() => onSelectSignal(signal)}
                    infoButtonTapped={() => onSignalInfoSelected(signal)}
                    disabledInfo={effectiveDisabledInfo}
                  />
                </div>
              );
            })}
        </div>
      ) : (
        <RuleFormSignalModalNoSearchResults />
      )}
    </div>
  );
}
