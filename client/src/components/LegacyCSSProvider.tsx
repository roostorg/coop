import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function LegacyCSSProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/styles/legacyStyles.css';
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [pathname]);

  return <>{children}</>;
}
