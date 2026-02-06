import { useMemo, useState } from 'react';
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atelierSulphurpoolLight } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

import CopyTextComponent from '../../../components/common/CopyTextComponent';

import {
  useGQLItemTypesQuery,
  type GQLItemType,
} from '../../../graphql/generated';
import ItemTypeCodeSampleDropdown from './ItemTypeCodeSampleDropdown';
import {
  generateRequestCode,
  RequestLanguages,
  type ApiRoute,
  type RequestLanguage,
} from './itemTypeCodeSampleUtils';

const requestLanguageForComponent = (requestLanguage: RequestLanguage) => {
  switch (requestLanguage) {
    case 'Curl':
      return 'shell';
    case 'Python':
      return 'python';
    case 'NodeJS':
      return 'javascript';
    case 'PHP':
      return 'php';
  }
};

export default function ItemTypeRequestCodeSamples(props: {
  itemTypeId?: string;
}) {
  const { itemTypeId } = props;
  const [selectedApiRoute, setSelectedApiRoute] =
    useState<ApiRoute>('Items API');
  const [selectedRequestLanguage, setSelectedRequestLanguage] =
    useState<RequestLanguage>('NodeJS');

  const { data } = useGQLItemTypesQuery();
  const defaultUserItemTypeId = data?.myOrg?.itemTypes?.find(
    (it) => it.__typename === 'UserItemType' && it.isDefaultUserType,
  )?.id;
  const selectedItemType = data?.myOrg?.itemTypes?.find(
    (it) => it.id === itemTypeId,
  );

  const requestCode = useMemo(() => {
    if (selectedItemType == null) {
      return '';
    } else {
      return generateRequestCode({
        apiRoute: selectedApiRoute,
        requestLanguage: selectedRequestLanguage,
        itemType: selectedItemType as GQLItemType,
        defaultUserItemTypeId,
      });
    }
  }, [
    selectedApiRoute,
    selectedRequestLanguage,
    selectedItemType,
    defaultUserItemTypeId,
  ]);

  return (
    <div className="flex flex-col">
      <div className="relative">
        <div className="flex flex-row items-center justify-between bg-slate-200">
          <div className="flex flex-row items-center grow">
            {Object.values(RequestLanguages).map((language) => (
              <div
                className={`px-3 py-2 cursor-pointer font-semibold h-full text-sm ${
                  language === selectedRequestLanguage
                    ? 'bg-primary/10'
                    : 'bg-slate-200 hover:bg-slate-100'
                }`}
                key={language}
                onClick={() => setSelectedRequestLanguage(language)}
              >
                {language}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute z-20 top-2 right-2">
          <ItemTypeCodeSampleDropdown
            selectedRoute={selectedApiRoute}
            onSelectRoute={setSelectedApiRoute}
          />
        </div>
      </div>
      <div className="relative overflow-y-scroll h-80">
        <SyntaxHighlighter
          customStyle={{
            backgroundColor: '#ffffff',
            padding: '16px 16px 0px 16px',
          }}
          style={{
            ...atelierSulphurpoolLight,
            // eslint-disable-next-line id-denylist
            'hljs-string': {
              color: '#75787B',
            },
            hljs: {
              color: 'text-gray-500',
              fontSize: '12px',
            },
          }}
          language={requestLanguageForComponent(selectedRequestLanguage)}
        >
          {requestCode}
        </SyntaxHighlighter>
        <div className="absolute z-10 p-1 border border-solid rounded-sm cursor-pointer top-2 right-2 text-slate-500 border-slate-400">
          <CopyTextComponent value={requestCode} displayValue="" />
        </div>
      </div>
    </div>
  );
}
