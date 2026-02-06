import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const useDynamicLegacyCSS = (isUsingLegacyCSS: boolean) => {
  const { pathname } = useLocation();
  const [cssLoaded, setCssLoaded] = useState(false);

  useEffect(() => {
    setCssLoaded(false);

    if (isUsingLegacyCSS) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/styles/legacyStyles.css';
      link.onload = () => setCssLoaded(true);
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    } else {
      setCssLoaded(true);
    }
  }, [pathname, isUsingLegacyCSS]);

  return cssLoaded;
};

export default useDynamicLegacyCSS;
