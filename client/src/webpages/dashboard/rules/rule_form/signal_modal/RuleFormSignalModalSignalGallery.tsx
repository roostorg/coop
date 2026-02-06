import { useGQLIsDemoOrgQuery } from '@/graphql/generated';
import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { useMemo, useState } from 'react';

import { CoreSignal } from '../../../../../models/signal';
import { INTEGRATION_CONFIGS } from '../../../integrations/integrationConfigs';
import RuleFormSignalModalMenuItem from './RuleFormSignalModalMenuItem';
import RuleFormSignalModalNoSearchResults from './RuleFormSignalModalNoSearchResults';

export default function RuleFormSignalModalSignalGallery(props: {
  allSignals: CoreSignal[];
  onSelectSignal: (signal: CoreSignal) => void;
  onSignalInfoSelected: (signal: CoreSignal) => void;
}) {
  const { allSignals, onSelectSignal, onSignalInfoSelected } = props;
  const { data: isDemoOrgData } = useGQLIsDemoOrgQuery();
  const isDemoOrg = isDemoOrgData?.myOrg?.isDemoOrg ?? false;

  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredSignals = useMemo(
    () =>
      allSignals
        // First filter out disabled signals
        .filter((signal) =>
          INTEGRATION_CONFIGS.some(
            (config) =>
              signal.integration === config.name || signal.integration === null,
          ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDemoOrg, searchTerm],
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
            .sort((a, b) =>
              a.disabledInfo.disabled && !b.disabledInfo.disabled
                ? 1
                : !a.disabledInfo.disabled && b.disabledInfo.disabled
                ? -1
                : `${a.integration}_${a.name}`.localeCompare(
                    `${b.integration}_${b.name}`,
                  ),
            )
            .map((signal) => (
              <div key={signal.name}>
                <RuleFormSignalModalMenuItem
                  key={signal.id}
                  signal={signal}
                  imagePath={
                    INTEGRATION_CONFIGS.find(
                      (it) => it.name === signal.integration,
                    )?.logoWithBackground
                  }
                  onClick={() => onSelectSignal(signal)}
                  infoButtonTapped={() => onSignalInfoSelected(signal)}
                  disabledInfo={signal.disabledInfo}
                />
              </div>
            ))}
        </div>
      ) : (
        <RuleFormSignalModalNoSearchResults />
      )}
    </div>
  );
}
