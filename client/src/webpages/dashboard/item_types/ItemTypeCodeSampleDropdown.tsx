import { CheckOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useState } from 'react';

import { ApiRoutes, type ApiRoute } from './itemTypeCodeSampleUtils';

export default function ItemTypeCodeSampleDropdown(props: {
  selectedRoute: ApiRoute;
  onSelectRoute: (route: ApiRoute) => void;
}) {
  const { selectedRoute, onSelectRoute } = props;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col text-sm font-semibold cursor-pointer select-none bg-slate-200">
      <div
        className="flex flex-row px-2"
        onClick={() => setMenuOpen((prevMenuOpen) => !prevMenuOpen)}
      >
        {selectedRoute}
        <div className="ml-2">
          {menuOpen ? <UpOutlined /> : <DownOutlined />}
        </div>
      </div>
      {menuOpen && (
        <div className="flex flex-col py-2">
          {Object.values(ApiRoutes).map((route, idx) => (
            <div
              className={`flex flex-row p-2 ${
                route === selectedRoute ? '' : 'bg-slate-200 hover:bg-slate-100'
              }`}
              key={idx}
              onClick={() => {
                setMenuOpen(false);
                onSelectRoute(route);
              }}
            >
              {route}
              {route === selectedRoute && <CheckOutlined className="ml-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
