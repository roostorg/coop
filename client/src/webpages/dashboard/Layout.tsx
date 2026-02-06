import { RouteHandle } from '@/webpages/dashboard/Dashboard';
import React from 'react';
import { Outlet, useLocation, useMatches } from 'react-router-dom';

import ErrorBoundary from '@/components/ErrorBoundary';

interface LayoutProps {
  sidebarSlot: React.ReactNode;
}

const Layout = ({ sidebarSlot }: LayoutProps) => {
  const { pathname } = useLocation();

  const matches = useMatches();
  const currentRouteHandle = matches[matches.length - 1]?.handle as RouteHandle;

  return (
    <div className="flex w-full h-screen bg-slate-50">
      {sidebarSlot}
      <main className="flex flex-col flex-grow overflow-y-auto min-h-0">
        <div className="p-10">
          <ErrorBoundary
            key={pathname}
            containedInLayout
            buttonTitle={currentRouteHandle?.error?.buttonTitle}
            buttonLinkPath={currentRouteHandle?.error?.buttonLinkPath}
          >
            <div className="w-full max-w-[1280px]">
              <Outlet />
            </div>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Layout;
