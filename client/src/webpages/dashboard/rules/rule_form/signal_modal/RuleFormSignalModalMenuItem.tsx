import { RightOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import startCase from 'lodash/startCase';

import {
  GQLDisabledInfo,
  GQLSignalType,
} from '../../../../../graphql/generated';
import LogoWhiteWithBackground from '../../../../../images/LogoWhiteWithBackground.png';
import { CoreSignal } from '../../../../../models/signal';
import {
  type IntegrationConfig,
  INTEGRATION_CONFIGS,
} from '../../../integrations/integrationConfigs';

/** Vendor/company name for display. Uses signal.integrationTitle (from API) when set, else static config, else formatted id. */
export function vendorName(signal: CoreSignal) {
  if (signal.type === GQLSignalType.Custom) {
    return 'Custom';
  }
  if (!signal.integration) {
    return 'Coop';
  }
  if (signal.integrationTitle) {
    return signal.integrationTitle;
  }
  const staticConfig = INTEGRATION_CONFIGS.find(
    (it: IntegrationConfig) => it.name === signal.integration,
  );
  if (staticConfig) {
    return staticConfig.title;
  }
  return typeof signal.integration === 'string'
    ? signal.integration.replace(/_/g, ' ')
    : 'Plugin';
}

export function signalDisplayName(signal: CoreSignal, hideVendor = true) {
  const { integration, name } = signal;
  if (!integration) {
    return name;
  }

  const integrationConfig = INTEGRATION_CONFIGS.find(
    (it: IntegrationConfig) => it.name === integration,
  );
  if (!integrationConfig) {
    return name;
  }

  return startCase(name.replace(integrationConfig?.title, ''));
}

export default function RuleFormSignalModalMenuItem(props: {
  signal: CoreSignal;
  infoButtonTapped: () => void;
  onClick: (signal: CoreSignal) => void;
  imagePath?: string;
  disabledInfo: GQLDisabledInfo;
}) {
  const { signal, infoButtonTapped, onClick, imagePath, disabledInfo } = props;
  const item = (
    <div
      className={`flex flex-col rounded-lg border border-solid border-slate-200 p-4 w-60 cursor-pointer drop-shadow h-full ${
        disabledInfo.disabled ? 'bg-gray-100' : 'bg-white hover:bg-sky-100'
      }`}
      onClick={() => {
        if (!disabledInfo.disabled) {
          onClick(signal);
        }
      }}
    >
      <div className="flex flex-row items-start">
        <div className="flex flex-col">
          {/* Every signal should be exactly 2 lines */}
          <div
            className={`font-semibold text-base pb-0.5 ${
              disabledInfo.disabled ? 'text-gray-400' : ''
            }`}
          >
            {signalDisplayName(signal)}
          </div>
          <div className="font-semibold text-gray-400 pt-0.5 text-sm">
            {vendorName(signal)}
          </div>
        </div>
        <div className="flex-1" />
        <img
          alt="logo"
          className="ml-4 rounded-full w-11 h-11 drop-shadow"
          src={imagePath ?? LogoWhiteWithBackground}
        />
      </div>
      <div className="flex-1" />
      <div className="flex h-px my-4 bg-slate-300" />
      <div className="flex flex-row items-center justify-between">
        <div className="overflow-hidden text-sm text-gray-400 text-ellipsis line-clamp-2">
          {signal.description}
        </div>
        <RightOutlined
          className="p-1 ml-2 rounded-full text-slate-400 hover:bg-slate-300"
          onClick={(event) => {
            event.stopPropagation();
            infoButtonTapped();
          }}
        />
      </div>
    </div>
  );

  if (disabledInfo.disabled) {
    return <Tooltip title={disabledInfo.disabledMessage}>{item}</Tooltip>;
  }
  return item;
}
