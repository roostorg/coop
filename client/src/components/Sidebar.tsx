import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { GQLUserPermission } from '@/graphql/generated';
import { CogFilled, ExitFilled, UserAlt3Filled } from '@/icons';
import { ReactComponent as AngleDoubleLeft } from '@/icons/lni/Direction/angle-double-left.svg';
import { ReactComponent as AngleDoubleRight } from '@/icons/lni/Direction/angle-double-right.svg';
import { cn } from '@/lib/utils';
import { makeEnumLike } from '@roostorg/types';
import React, {
  ReactElement,
  useEffect,
  useMemo,
  useState,
  type SVGProps,
} from 'react';
import { Link, useLocation } from 'react-router-dom';

import DashboardMenuButton from '@/webpages/dashboard/components/DashboardMenuButton';

import LogoAndWordmarkPurple from '../images/LogoAndWordmarkPurple.png';

const MenuItemNames = makeEnumLike([
  'Overview',
  'Automated Enforcement',
  'Proactive Rules',
  'Report Rules',
  'Review Console',
  'Queues',
  'Routing',
  'Analytics',
  'Investigation',
  'Bulk Actioning',
  'Recent Decisions',
  'NCMEC Reports',
  'Policies',
  'Matching Banks',
  'Log Out',
  'Account',
  'Settings',
  'Item Types',
  'Actions',
  'API Keys',
  'Integrations',
  'Appeal Settings',
  'Users',
  'Employee Safety',
  'NCMEC Settings',
  'SSO',
  'Organization',
]);

type MenuItemName = keyof typeof MenuItemNames;

export type MenuItem = {
  title: MenuItemName;
  urlPath: string;
  icon?: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
  requiredPermissions: GQLUserPermission[];
  subItems?: Omit<MenuItem, 'subItems'>[];
};

interface SidebarProps {
  menuItems: MenuItem[];
  settingsMenuItems: MenuItem[];
  selectedMenuItem: string | null;
  setSelectedMenuItem: React.Dispatch<React.SetStateAction<string | null>>;
  permissions: readonly GQLUserPermission[] | undefined;
  logout: () => void;
  isDemoOrg?: boolean;
}

export default function Sidebar(props: SidebarProps) {
  const {
    menuItems,
    settingsMenuItems,
    selectedMenuItem,
    setSelectedMenuItem,
    permissions,
    logout,
    isDemoOrg,
  } = props;

  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const pathParts = pathname.split('/');
    let items: MenuItem[] = [...menuItems, ...settingsMenuItems];

    if (pathParts.length < 2) {
      return;
    }

    for (let i = 2; i < pathParts.length; i++) {
      const part = pathParts[i];
      const item = items.find((item) => item.urlPath === part);
      if (item == null) {
        return;
      }
      if (item.subItems) {
        items = item.subItems;
      } else {
        setSelectedMenuItem(item.title);
      }
    }
  }, [menuItems, pathname, settingsMenuItems, setSelectedMenuItem]);

  const isSettingsSelected = useMemo(
    () =>
      settingsMenuItems[0]?.subItems?.some(
        (item) => item.title === selectedMenuItem,
      ) ?? false,
    [selectedMenuItem, settingsMenuItems],
  );

  const isDescendant = (
    parent: MenuItem,
    descendantTitle: string | null,
  ): boolean => {
    if (descendantTitle == null) {
      return false;
    }
    return (
      parent.subItems != null &&
      parent.subItems.some(
        (subItem) =>
          subItem.title === descendantTitle ||
          isDescendant(subItem, descendantTitle),
      )
    );
  };

  const recursiveMenuItems = (
    item: MenuItem,
    level: number,
    prevUrlPath: string,
  ): ReactElement | null => {
    if (
      item.requiredPermissions.filter(
        (perm) => permissions?.includes(perm) ?? false,
      ).length < item.requiredPermissions.length
    ) {
      return null;
    }
    const subItems = item.subItems?.map((subItem, i) => (
      <React.Fragment key={i}>
        {recursiveMenuItems(subItem, level + 1, item.urlPath)}
      </React.Fragment>
    ));
    const isInSelectedPath =
      selectedMenuItem === item.title || isDescendant(item, selectedMenuItem);
    return (
      <div className="flex flex-col justify-start">
        <DashboardMenuButton
          title={item.title}
          url={
            prevUrlPath.length > 0
              ? `${prevUrlPath}/${item.urlPath}`
              : `${item.urlPath}`
          }
          selected={selectedMenuItem === item.title}
          onClick={() => {
            if (collapsed) {
              setCollapsed(false);
            }
            setSelectedMenuItem(item.title);
          }}
          level={level}
          icon={item.icon}
          collapsed={collapsed}
          highlighted={isInSelectedPath && level === 0}
        />
        {!collapsed && isInSelectedPath ? subItems : null}
      </div>
    );
  };

  const footerButton = (
    props: {
      icon: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
      menuItemName: MenuItemName;
    } & (
      | { onClick: () => void; url?: undefined }
      | { onClick?: undefined; url: string }
    ),
  ) => {
    const { icon: Icon, menuItemName, onClick, url } = props;
    const isFooterButtonSelected =
      selectedMenuItem === menuItemName ||
      (menuItemName === 'Settings' && isSettingsSelected);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {onClick ? (
            <div
              className={`flex cursor-pointer w-min h-min p-[8px] rounded border-none ${
                isFooterButtonSelected
                  ? 'text-primary hover:text-primary bg-indigo-50 hover:bg-indigo-50'
                  : 'text-black hover:text-black/70 bg-transparent hover:bg-gray-100'
              }`}
              onClick={() => {
                onClick();
                setSelectedMenuItem(menuItemName);
              }}
            >
              <Icon
                style={{ width: '16px', height: '16px' }}
                className="fill-black"
              />
            </div>
          ) : (
            <Link
              to={url}
              className={`flex cursor-pointer w-min h-min p-[8px] rounded border-none ${
                isFooterButtonSelected
                  ? 'text-primary hover:text-primary bg-indigo-50 hover:bg-indigo-50'
                  : 'text-black hover:text-black/70 bg-transparent hover:bg-gray-100'
              }`}
              onClick={() => setSelectedMenuItem(menuItemName)}
            >
              <Icon
                style={{ width: '16px', height: '16px' }}
                className="fill-black"
              />
            </Link>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">{menuItemName}</TooltipContent>
      </Tooltip>
    );
  };

  const isSettingsMenuVisible = isSettingsSelected && !collapsed;

  const settingsMenu = (
    <div
      className={cn(
        'bg-slate-50 overflow-hidden',
        'border border-t-0 border-gray-200 border-solid border-x-0',
        {
          'max-h-[1000px]': isSettingsMenuVisible,
          'max-h-0': !isSettingsMenuVisible,
        },
      )}
      style={{
        transition: 'max-height 0.5s ease-in-out',
      }}
    >
      <div className="flex flex-col gap-[4px] m-[16px]">
        {settingsMenuItems[0]?.subItems?.map((item) => (
          <Link
            key={item.title}
            to={`settings/${item.urlPath}`}
            className={`flex text-start items-center rounded-lg my-[4px] cursor-pointer hover:text-primary ${
              selectedMenuItem === item.title
                ? 'text-primary font-bold'
                : 'text-black font-medium'
            } ${collapsed ? 'w-fit' : 'py-[6px] px-[8px]'}`}
            onClick={() => setSelectedMenuItem(item.title)}
          >
            <div className="pl-[12px] whitespace-nowrap text-[14px]">
              {item.title}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`relative flex flex-col justify-between bg-white ${
        collapsed ? '' : 'min-w-[250px]'
      } text-[14px]`}
    >
      <div className="flex flex-col p-[14px]">
        <div className="flex items-center justify-between mb-[24px]">
          {!collapsed && (
            <Link to="/" className="mt-[4px] ml-[4px] text-start">
              <img
                src={LogoAndWordmarkPurple}
                alt="Logo"
                width="110"
                height="29"
              />
            </Link>
          )}
          <div
            className="flex p-[8px] rounded cursor-pointer hover:bg-primary/10 h-min"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? (
              <AngleDoubleRight
                style={{ width: '16px', height: '16px' }}
                className="fill-black"
              />
            ) : (
              <AngleDoubleLeft
                style={{ width: '16px', height: '16px' }}
                className="fill-black"
              />
            )}
          </div>
        </div>
        {menuItems.map((item, i) => (
          <React.Fragment key={i}>
            {recursiveMenuItems(item, 0, '')}
          </React.Fragment>
        ))}
      </div>

      <div className="absolute bottom-0 flex flex-col justify-end w-full gap-0">
        {isDemoOrg ? (
          <div className="flex justify-center py-1 m-4 mx-8 text-center text-yellow-800 bg-yellow-100 rounded-lg grow">
            Demo Account
          </div>
        ) : null}
        {settingsMenu}
        <div className="flex justify-center gap-[20px] p-[16px] bg-slate-50">
          {!collapsed &&
            footerButton({
              icon: ExitFilled,
              menuItemName: 'Log Out' as const,
              onClick: async () => logout(),
            })}
          {!(collapsed && selectedMenuItem === 'Account') &&
            footerButton({
              icon: CogFilled,
              menuItemName: 'Settings' as const,
              url: '/dashboard/settings',
            })}
          {!(collapsed && selectedMenuItem !== 'Account') &&
            footerButton({
              icon: UserAlt3Filled,
              menuItemName: 'Account' as const,
              url: '/dashboard/account',
            })}
        </div>
      </div>
    </div>
  );
}
