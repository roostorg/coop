import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import CoopModal from '../components/CoopModal';

import type { GQLIntegrationMetadata } from '../../../graphql/generated';
import { INTEGRATION_LOGO_FALLBACKS } from './integrationLogos';

export default function IntegrationCard(props: {
  integration: GQLIntegrationMetadata;
  useExternalURL?: boolean;
  /** Whether the org has configured this integration (shown as ACTIVE). */
  active?: boolean;
}) {
  const { integration, useExternalURL, active } = props;
  const { name, title, docsUrl } = integration;
  const modelCards = integration.modelCards ?? [];
  // Integrations page uses only the plain logo (logoUrl from logoPath). Do not fall back to logoWithBackgroundUrl.
  const rawLogo =
    integration.logoUrl ?? INTEGRATION_LOGO_FALLBACKS[name]?.logo ?? '';
  // Resolve relative API paths to absolute URL so img loads correctly (e.g. /api/v1/integration-logos/ID).
  const logo =
    typeof rawLogo === 'string' && rawLogo.startsWith('/')
      ? `${window.location.origin}${rawLogo}`
      : rawLogo;
  const navigate = useNavigate();

  const [modalVisible, setModalVisible] = useState(false);

  const modal = (
    <CoopModal
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
      footer={[
        {
          title: 'Use My API Key',
          onClick: () => {
            navigate(`${name.toLowerCase()}`);
            setModalVisible(false);
          },
          type: 'primary',
        },
      ]}
    >
      <div className="flex flex-col items-center max-w-md">
        <div className="p-6 mb-6 rounded-full bg-slate-200 w-fit h-fit flex items-center justify-center">
          {logo ? (
            <img src={logo} alt="" className="w-16 h-16 object-contain" />
          ) : null}
        </div>
        <div>
          <span className="font-medium">{title}</span> doesn't require any
          information from you. But if you'd like to use your existing API
          key(s), you can.
        </div>
      </div>
    </CoopModal>
  );

  // If the component is explicitly configured to link to the external url
  // (e.g., because we're rendering the card in a signed out state), use a
  // standard <a>. Otherwise, use a react-router link, unless we just need to
  // open a modal.
  const Wrapper = ({
    children,
    ...rest
  }: {
    children: ReactNode[];
    [k: string]: unknown;
  }) => {
    if (Boolean(useExternalURL)) {
      return (
        <a href={docsUrl} {...rest}>
          {children}
        </a>
      );
    }
    if (!integration.requiresConfig) {
      return (
        <div onClick={() => setModalVisible(true)} {...rest}>
          {children}
        </div>
      );
    } else {
      // Cast name to lowercase so the end user doesn't see an
      // ENUM_FORMAT URL param
      return (
        <Link to={name.toLowerCase()} {...rest}>
          {children}
        </Link>
      );
    }
  };

  return (
    <>
      <Wrapper className="relative flex flex-col w-full h-full p-6 text-start bg-white border border-solid rounded-3xl border-slate-300 transition-all duration-200 ease-out box-border hover:transform hover:-translate-y-1 hover:transition-all hover:duration-200 hover:ease-in hover:dashboard-border-primary/70 hover:cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-contain" />
            ) : null}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-bold text-slate-700 truncate">
              {title}
            </span>
            {modelCards.length > 0 && (
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                {modelCards.length}{' '}
                {modelCards.length === 1 ? 'MODEL' : 'MODELS'}
              </span>
            )}
          </div>
        </div>
        {modelCards.length > 0 && (
          <>
            <div className="h-px my-4 bg-slate-200" />
            <div className="flex flex-col gap-3">
              {modelCards.map((card, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-base font-bold text-slate-800">
                    {card.modelName}
                  </span>
                  <span className="text-sm text-slate-400">
                    {[card.version, card.releaseDate].filter(Boolean).join(' ')}
                    {Boolean(active) && i === 0 && (
                      <span className="font-semibold text-indigo-500">
                        {' '}
                        • ACTIVE
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Wrapper>
      {modal}
    </>
  );
}
