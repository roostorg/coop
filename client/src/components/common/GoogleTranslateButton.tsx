import React, { useEffect } from 'react';

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: any;
  }
}

const initializeGoogleTranslate = () => {
  return new window.google.translate.TranslateElement(
    {
      pageLanguage: 'auto',
      includedLanguages: 'en',
      layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
    },
    'google_translate_element',
  );
};

const loadGoogleTranslateScript = (callback: () => void) => {
  const existingScript = document.getElementById('google-translate-script');

  if (!existingScript) {
    const script = document.createElement('script');
    script.src =
      '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.id = 'google-translate-script';
    document.body.appendChild(script);

    script.onload = () => {
      if (typeof callback === 'function') callback();
    };
  } else if (existingScript && callback) {
    callback();
  }
};

const GoogleTranslateButton: React.FC = () => {
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        initializeGoogleTranslate();
      }
    };

    loadGoogleTranslateScript(() => {
      if (window.google && window.google.translate) {
        window.googleTranslateElementInit();
      }
    });

    return () => {
      const script = document.getElementById('google-translate-script');
      if (script) {
        script.remove();
      }
    };
  }, []);

  return (
    <div>
      <div id="google_translate_element"></div>
    </div>
  );
};

export default GoogleTranslateButton;
