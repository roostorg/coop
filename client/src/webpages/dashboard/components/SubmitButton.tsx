import { Button } from '@/coop-ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/coop-ui/Tooltip';
import { placementToSideAlign, type TooltipPlacement } from '@/lib/tooltip';
import { Link } from 'react-router-dom';

type SubmitButtonSize = 'small' | 'middle' | 'large';

const COOP_BUTTON_SIZE: Record<SubmitButtonSize, 'sm' | 'default' | 'lg'> = {
  small: 'sm',
  middle: 'default',
  large: 'lg',
};

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
  size?: SubmitButtonSize;
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
        type="submit"
        onClick={(event) => onClick && onClick(event)}
        size={COOP_BUTTON_SIZE[size ?? 'large']}
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            {...placementToSideAlign(disabledTooltipPlacement ?? 'bottomRight')}
          >
            {disabledTooltipTitle}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : destination != null ? (
      <Link to={destination}>{button}</Link>
    ) : (
      button
    );
  if (submitsForm) {
    return <div className="mt-4 mb-8">{buttonWrapper}</div>;
  }
  return buttonWrapper;
}
