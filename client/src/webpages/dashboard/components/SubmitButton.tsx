import { Button, Form, Tooltip } from 'antd';
import { SizeType } from 'antd/lib/config-provider/SizeContext';
import { TooltipPlacement } from 'antd/lib/tooltip';
import { Link } from 'react-router-dom';

export default function SubmitButton(props: {
  title: string;
  disabled?: boolean;
  loading?: boolean;
  destination?: string;
  submitsForm?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  error?: boolean;
  errorMessage?: string;
  // If these disabledTooltip props are provided and the button
  // is disabled, a tooltip will render explaining why it's disabled
  showDisabledTooltip?: boolean;
  disabledTooltipTitle?: string;
  disabledTooltipPlacement?: TooltipPlacement;
  size?: SizeType;
}) {
  const {
    title,
    disabled,
    loading,
    destination,
    submitsForm,
    error,
    errorMessage,
    showDisabledTooltip,
    disabledTooltipTitle,
    disabledTooltipPlacement,
    size,
    onClick,
  } = props;

  const button = (
    <div>
      <Button
        className={`${
          disabled
            ? '!bg-slate-200 !text-slate-400 cursor-not-allowed'
            : 'cursor-pointer !bg-primary hover:!bg-primary/70 !text-white'
        } rounded-lg !border-none shadow-none min-w-[64px] font-medium`}
        type="primary"
        htmlType="submit"
        onClick={(event) => onClick && onClick(event)}
        size={size ?? 'large'}
        disabled={disabled ?? false}
        loading={loading ?? false}
      >
        {title}
      </Button>
      {Boolean(error) && (
        <div className="pl-4 text-coop-alert-red">
          {errorMessage ?? 'Please see the errors above.'}
        </div>
      )}
    </div>
  );

  const buttonWrapper =
    Boolean(disabled) &&
    Boolean(showDisabledTooltip) &&
    disabledTooltipTitle ? (
      <Tooltip
        title={disabledTooltipTitle}
        placement={disabledTooltipPlacement ?? 'bottomRight'}
      >
        {button}
      </Tooltip>
    ) : destination != null ? (
      <Link to={destination}>{button}</Link>
    ) : (
      button
    );
  if (submitsForm) {
    return <Form.Item className="mt-4 mb-8">{buttonWrapper}</Form.Item>;
  }
  return buttonWrapper;
}
