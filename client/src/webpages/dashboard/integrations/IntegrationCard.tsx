import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import CoopModal from '../components/CoopModal';

import { IntegrationConfig } from './IntegrationsDashboard';

export default function IntegrationCard(props: {
  integration: IntegrationConfig;
  useExternalURL?: boolean;
}) {
  const { integration, useExternalURL } = props;
  const { name, title, logo, requiresInfo, url } = integration;
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
        <div className="p-6 mb-6 rounded-full bg-slate-200 w-fit h-fit">
          <img src={logo} alt="Logo" className="w-16 h-16" />
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
        <a href={url} {...rest}>
          {children}
        </a>
      );
    }
    if (!requiresInfo) {
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
      <Wrapper className="relative flex flex-col items-center justify-center w-full h-full p-6 pt-12 pb-12 bg-white border border-solid rounded-3xl border-slate-300 transition-all duration-200 ease-out box-border hover:transform hover:-translate-y-1 hover:transition-all hover:duration-200 hover:ease-in hover:dashboard-border-primary/70 hover:cursor-pointer">
        <div className="w-16 h-16 p-4 mb-6 rounded-full bg-slate-200">
          <img src={logo} alt="Logo" className="w-full h-full" />
        </div>
        <div className="flex flex-col justify-start text-lg font-bold text-center text-slate-700">
          {title}
        </div>
      </Wrapper>
      {modal}
    </>
  );
}
