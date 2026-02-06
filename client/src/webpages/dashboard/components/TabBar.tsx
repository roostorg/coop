import { Tooltip } from 'antd';
import { useEffect, useState, type ReactElement } from 'react';

type TabInfo<T extends string> = {
  label: string;
  value: T;
  icon?: ReactElement;
  tooltip?: string;
  disabled?: boolean;
};

export default function TabBar<T extends string>(props: {
  tabs: TabInfo<T>[];
  initialSelectedTab: T;
  onTabClick: (tab: T) => void;
  currentSelectedTab?: T;
}) {
  const { tabs, initialSelectedTab, onTabClick, currentSelectedTab } = props;
  const [selectedTab, setSelectedTab] = useState(initialSelectedTab);

  useEffect(() => {
    if (currentSelectedTab !== undefined) {
      setSelectedTab(currentSelectedTab);
    }
  }, [currentSelectedTab]);

  const handleTabClick = (tab: T) => {
    setSelectedTab(tab);
    onTabClick(tab);
  };

  const tabComponent = (tab: TabInfo<T>) => {
    const { label, value, icon, tooltip, disabled } = tab;
    const isActive = selectedTab === value;

    const tabButton = (
      <div
        className={`inline-flex items-center bg-transparent border-solid border-0 border-b-2 p-4 gap-x-2 whitespace-nowrap hover:text-primary focus:outline-none focus:text-primary disabled:opacity-50 disabled:pointer-events-none dark:text-neutral-400 dark:hover:text-primary ${
          isActive
            ? 'font-semibold  border-b-primary text-primary'
            : 'text-gray-500 border-b-gray-200 fill-gray-500'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        id={`${value}-tab`}
        role="tab"
        onClick={() => !disabled && handleTabClick(value)}
      >
        {icon}
        {label}
      </div>
    );

    return tooltip ? <Tooltip title={tooltip}>{tabButton}</Tooltip> : tabButton;
  };

  return (
    <nav className="flex mb-4" aria-label="Tabs" role="tablist">
      {tabs.map((tab) => tabComponent(tab))}
    </nav>
  );
}
