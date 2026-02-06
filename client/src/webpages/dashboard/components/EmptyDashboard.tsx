import { Tooltip } from 'antd';
import { Link } from 'react-router-dom';

import CoopButton from './CoopButton';

export default function EmptyDashboard(
  props: {
    buttonTitle: string;
    dashboardName: string;
    icon: React.ReactElement;
    buttonDisabled?: boolean;
    disabledTooltipTitle?: string;
  } & ({ buttonLinkPath: string } | { onClick: () => void }),
) {
  const {
    buttonTitle,
    dashboardName,
    icon,
    buttonDisabled,
    disabledTooltipTitle,
    ...otherProps
  } = props;

  if ('buttonLinkPath' in otherProps && 'onClick' in otherProps) {
    throw new Error(
      'Please pass in either a buttonLinkPath or an onClick handler, but not both.',
    );
  }

  const { buttonLinkPath, onClick } =
    'buttonLinkPath' in otherProps
      ? { buttonLinkPath: otherProps.buttonLinkPath, onClick: undefined }
      : { buttonLinkPath: undefined, onClick: otherProps.onClick };

  const createButton = (
    <CoopButton
      title={buttonTitle}
      disabled={buttonDisabled}
      onClick={onClick}
    />
  );

  const createButtonWrapped = (() => {
    if (buttonDisabled && disabledTooltipTitle) {
      return (
        <Tooltip title={disabledTooltipTitle} placement="bottom">
          {createButton}
        </Tooltip>
      );
    }

    if (buttonLinkPath) {
      return <Link to={buttonLinkPath}>{createButton}</Link>;
    }

    return createButton;
  })();

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center justify-center p-12 mt-24 bg-white shadow-md rounded-xl text-slate-500">
        <div className="pb-3 text-neutral-300 text-8xl">{icon}</div>
        <div className="text-slate-500 text-3xl max-w-[400px] pb-2">
          No {dashboardName}
        </div>
        <div className="text-slate-500 text-base pt-2 pb-10 max-w-[400px]">
          Looks like you haven't created any {dashboardName.toLowerCase()} yet.
          Click the button below to get started!
        </div>
        {createButtonWrapped}
      </div>
    </div>
  );
}
