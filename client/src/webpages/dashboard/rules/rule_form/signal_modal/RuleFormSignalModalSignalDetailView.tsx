import { SignalSubcategory } from '@roostorg/types';
import capitalize from 'lodash/capitalize';

import CoopButton from '@/webpages/dashboard/components/CoopButton';

import {
  GQLSignalPricingStructureType,
  GQLSignalSubcategory,
} from '../../../../../graphql/generated';
import LogoWhiteWithBackground from '../../../../../images/LogoWhiteWithBackground.png';
import { CoreSignal } from '../../../../../models/signal';
import {
  type IntegrationConfig,
  INTEGRATION_CONFIGS,
} from '../../../integrations/integrationConfigs';
import { signalDisplayName } from './RuleFormSignalModalMenuItem';

export default function RuleFormSignalModalSignalDetailView(props: {
  signal: CoreSignal;
  subcategories: SignalSubcategory[];
  onSelectSignal: (
    signal: CoreSignal,
    subcategory?: GQLSignalSubcategory,
  ) => void;
}) {
  const { signal, subcategories, onSelectSignal } = props;
  const staticConfig = INTEGRATION_CONFIGS.find(
    (it: IntegrationConfig) => it.name === signal.integration,
  );
  const integrationTitle =
    signal.integrationTitle ??
    staticConfig?.title ??
    (typeof signal.integration === 'string'
      ? signal.integration
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^([a-z])|\s+([a-z])/g, (m) => m.toUpperCase())
      : 'Coop');
  // Signals use the logo-with-background variant.
  const rawLogoSrc =
    signal.integrationLogoWithBackgroundUrl ??
    staticConfig?.logoWithBackground ??
    LogoWhiteWithBackground;
  const logoSrc =
    typeof rawLogoSrc === 'string' && rawLogoSrc.startsWith('/')
      ? `${window.location.origin}${rawLogoSrc}`
      : rawLogoSrc;

  const infoSectionData = [
    {
      label: 'Developer',
      value: (
        <div className="items-center justify-center font-semibold text-gray-500">
          <img
            alt="logo"
            className="w-8 h-8 mr-2 rounded-full"
            src={logoSrc}
          />{' '}
          {integrationTitle}
        </div>
      ),
    },
    ...(signal.recommendedThresholds
      ? [
          {
            label: 'Recommended Thresholds',
            value: (
              <div className="flex flex-col items-start justify-center">
                <div>
                  Fewer false positives:{' '}
                  <span className="font-semibold">
                    {signal.recommendedThresholds.highPrecisionThreshold}
                  </span>
                </div>
                <div>
                  Fewer false negatives:{' '}
                  <span className="font-semibold">
                    {signal.recommendedThresholds.highRecallThreshold}
                  </span>
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      label: 'Pricing Structure',
      value: (() => {
        switch (signal.pricingStructure.type) {
          case GQLSignalPricingStructureType.Free:
            return 'Free';
          case GQLSignalPricingStructureType.Subscription:
            return 'Subscription';
        }
      })(),
    },

    ...(signal.supportedLanguages.__typename === 'Languages' &&
    !signal.supportedLanguages.languages.length
      ? []
      : [
          {
            label: 'Supported Languages',
            value: (
              <div className="flex flex-row items-start justify-center">
                {signal.supportedLanguages.__typename === 'AllLanguages'
                  ? 'All'
                  : signal.supportedLanguages.languages
                      .map((lang) => capitalize(lang))
                      .join(', ')}
              </div>
            ),
          },
        ]),
  ];
  const subcategorySection = ((signal: CoreSignal) => {
    if (!signal.eligibleSubcategories.length) {
      return null;
    }

    return (
      <div className="flex flex-col">
        <div className="pb-4 mt-8 font-bold">Subcategories</div>
        <ul>
          {subcategories.map((subcategory) => (
            <li key={subcategory.id}>
              <div className="flex flex-col" key={subcategory.id}>
                {subcategory.label}
                {subcategory.children?.length && (
                  <ul>
                    {subcategory.children.map((child) => (
                      <li key={`${child.id}-wrapper`}>
                        <span className="italic">{child.label}</span>:{' '}
                        {child.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  })(signal);

  return (
    <div className="flex flex-col max-w-screen-md p-2">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col items-start">
          <div className="text-2xl font-bold">{signalDisplayName(signal)}</div>
        </div>
        <CoopButton
          title="Use Signal"
          onClick={() => onSelectSignal(signal)}
          size="middle"
          disabled={signal.disabledInfo.disabled}
          disabledTooltipTitle={
            signal.disabledInfo.disabledMessage ?? undefined
          }
          disabledTooltipPlacement="leftBottom"
        />
      </div>
      <div className="!my-8 divider" />
      {infoSectionData ? (
        <div className="grid grid-cols-2 gap-8">
          {infoSectionData.map((entry) => (
            <div
              className="flex flex-col items-start justify-start"
              key={entry.label}
            >
              <div className="font-bold">{entry.label}</div>
              <div className="mt-4 font-semibold text-gray-500">
                {entry.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="!my-8 divider" />
      <div className="flex flex-col">
        <div className="flex flex-row pb-4 font-bold">Details</div>
        <div className="max-w-full whitespace-pre-line">
          {signal.description}
        </div>
        {subcategorySection}
        {signal.docsUrl ? (
          <a href={signal.docsUrl} className="mt-8 font-bold">
            Click to see Documentation
          </a>
        ) : null}
      </div>
    </div>
  );
}
