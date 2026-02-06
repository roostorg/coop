import { ReactComponent as SpinnerSolid } from '@/icons/lni/Spinner/spinner-solid.svg';
import { Tooltip } from 'antd';
import { TooltipPlacement } from 'antd/lib/tooltip';
import type { SVGProps } from 'react';
import { Link } from 'react-router-dom';

export type CoopButtonSize = 'small' | 'middle' | 'large';
export type CoopButtonType =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'green'
  | 'link';
export type CoopButtonFontWeight = 'normal' | 'semibold';

export default function CoopButton(
  props: {
    disabled?: boolean;
    destination?: string;
    onClick?:
      | ((e?: React.MouseEvent<HTMLElement>) => void)
      | ((e: React.MouseEvent<HTMLElement>) => void);
    tooltipTitle?: string;
    tooltipPlacement?: TooltipPlacement;
    disabledTooltipTitle?: string;
    disabledTooltipPlacement?: TooltipPlacement;
    loading?: boolean;
    fontWeight?: CoopButtonFontWeight;
    iconPosition?: 'left' | 'right';
  } & (
    | {
        title: string;
        icon?: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
      }
    | {
        icon: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
        title?: undefined;
      }
  ) &
    (
      | { type: 'link' }
      | { type?: Exclude<CoopButtonType, 'link'>; size?: CoopButtonSize }
    ),
) {
  const {
    title,
    icon: Icon,
    disabled,
    destination,
    tooltipTitle,
    tooltipPlacement,
    disabledTooltipTitle,
    disabledTooltipPlacement,
    onClick,
    type = 'primary',
    loading = false,
    fontWeight = 'semibold',
    iconPosition = 'left',
  } = props;
  const size = 'size' in props ? props.size ?? 'middle' : 'middle';

  const sizeProps = (() => {
    if (type === 'link') {
      // Link buttons should have much less padding
      return 'px-1 text-base';
    }
    switch (size) {
      case 'small':
        return 'py-1.5 px-3 text-base';
      case 'middle':
        return 'py-3 px-4 text-base';
      case 'large':
        return 'py-4 px-5 text-base';
    }
  })();

  const iconSizeProps = (() => {
    switch (size) {
      case 'small':
      case 'middle':
        return 'w-6 h-6';
      case 'large':
        return 'w-8 h-8';
    }
  })();

  const colorProps = (() => {
    switch (type) {
      case 'primary':
        return 'bg-primary text-white fill-white hover:bg-primary/70 border-transparent';
      case 'secondary':
        return 'bg-white text-primary fill-primary hover:bg-slate-100 hover:opacity-70 border-solid border-primary';
      case 'danger':
        return 'bg-coop-alert-red text-white fill-white hover:bg-coop-alert-red/70 border-transparent';
      case 'green':
        return 'bg-coop-success-green text-white fill-white hover:bg-coop-success-green/70 border-transparent';
      case 'link':
        return 'bg-transparent hover:bg-transparent text-primary hover:text-opacity-70 border-none';
    }
  })();

  const buttonIsDisabled = disabled ?? loading ?? false;

  const button = (
    <button
      type="button"
      className={`${sizeProps} ${colorProps} ${
        buttonIsDisabled
          ? '!bg-slate-200 !text-slate-400 cursor-not-allowed'
          : 'cursor-pointer'
      } ${
        fontWeight === 'semibold' ? 'font-semibold' : 'font-normal'
      } w-min whitespace-nowrap inline-flex items-center rounded border disabled:pointer-events-none h-fit`}
      onClick={(e) => onClick && onClick(e)}
      disabled={buttonIsDisabled}
    >
      {loading ? (
        <SpinnerSolid className="w-4 mr-2 animate-spin fill-inherit" />
      ) : null}
      <div className="flex items-center justify-center gap-2">
        {/* See https://stackoverflow.com/a/37414418 for why this is capitalized */}
        {Icon !== undefined && iconPosition === 'left' ? (
          <Icon className={`${iconSizeProps} fill-inherit text-inherit`} />
        ) : null}
        {title}
        {Icon !== undefined && iconPosition === 'right' ? (
          <Icon className={`${iconSizeProps} fill-inherit text-inherit`} />
        ) : null}
      </div>
    </button>
  );

  const buttonPossiblyWithLinkWrapper =
    destination != null ? <Link to={destination}>{button}</Link> : button;

  const finalButtonPossiblyWithTooltip =
    Boolean(disabled) && disabledTooltipTitle ? (
      <Tooltip
        title={disabledTooltipTitle}
        placement={disabledTooltipPlacement ?? 'bottomRight'}
        color="white"
      >
        {buttonPossiblyWithLinkWrapper}
      </Tooltip>
    ) : tooltipTitle ? (
      <Tooltip
        title={tooltipTitle}
        placement={tooltipPlacement ?? 'bottomRight'}
        color="white"
      >
        {buttonPossiblyWithLinkWrapper}
      </Tooltip>
    ) : (
      buttonPossiblyWithLinkWrapper
    );

  return finalButtonPossiblyWithTooltip;
}
