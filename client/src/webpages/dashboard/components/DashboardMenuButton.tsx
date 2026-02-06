import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import type { SVGProps } from 'react';
import { Link } from 'react-router-dom';

/**
 * The button in the Dashboard sidebar menu that lets
 * users navigate to various dashboard pages.
 */
export default function DashboardMenuButton(props: {
  selected: boolean;
  title: string;
  url: string;
  onClick: () => void;
  // Menu Items can be have sub items. This represents the level of the
  // item (top level = 0, sub items = 1, sub-sub items = 2, etc).
  level: number;
  icon?: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
  collapsed: boolean;
  highlighted: boolean;
}) {
  const {
    selected,
    title,
    url,
    onClick,
    level,
    icon: Icon,
    collapsed,
    highlighted,
  } = props;

  const button = (
    <Link
      to={url}
      className={`flex text-start items-center rounded-lg my-[4px] cursor-pointer hover:text-primary ${
        level === 0 ? 'hover:bg-primary/10' : ''
      } ${
        selected || highlighted
          ? `text-primary font-bold ${level === 0 ? 'bg-primary/10' : ''}`
          : 'text-black font-medium'
      } ${
        collapsed
          ? 'w-fit p-[8px]'
          : `px-[8px] ${level === 0 ? 'py-[8px]' : 'py-[6px]'}`
      }`}
      onClick={onClick}
      style={{
        marginLeft: level * 16,
        lineHeight: '16px',
      }}
    >
      {Icon ? (
        <Icon
          style={{ width: '20px', height: '20px' }}
          className="fill-black"
        />
      ) : null}
      {collapsed ? null : (
        <div
          className={`whitespace-nowrap ${
            level === 0 ? 'pl-[12px]' : 'pl-[32px]'
          }`}
        >
          {title}
        </div>
      )}
    </Link>
  );

  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}
