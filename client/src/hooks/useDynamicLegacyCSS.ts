import { useEffect, useState } from 'react';

const useDynamicLegacyCSS = (isUsingLegacyCSS: boolean) => {
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
  }, [isUsingLegacyCSS]);

  return cssLoaded;
};

export default useDynamicLegacyCSS;
