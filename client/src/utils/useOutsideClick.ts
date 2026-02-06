import { useEffect, useRef } from 'react';

/**
 * This hook can be used to capture clicks outside of a component.
 * For example, use this in a dropdown component to capture clicks
 * outside of the dropdown to close it.
 * @param onClick - the callback that gets called when a user clicks
 * outside the component in which this hook is used.
 *
 * Implementation details: https://www.robinwieruch.de/react-hook-detect-click-outside-component/
 */
export function useOutsideClick(onClick: (_: MouseEvent) => void) {
  const ref = useRef() as React.MutableRefObject<HTMLInputElement>;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      /**
       * Some ant design components have subcomponents that aren't
       * actually child components. They set separately in the component
       * tree and are positioned absolutely, not relatively. These components
       * are treated as part of the rest of the DOM, i.e. 'outside' the
       * component referenced by the ref param.
       * One example: the dropdown menu component in ant design's <Select />
       * component is not a child of the <Select /> component. So clicking an
       * item in the dropdown would normally trigger the onClick() function
       * here, as if it were outside the dropdown component altogether,
       * and we don't want that. So we have a few hardcoded ant design component
       * class names that we exempt from ever being considered 'outside' a
       * component that would use this hook.
       */
      const prohibitedClassNames = [
        'ant-select-item-option-content',
        'ant-picker-cell-inner',
      ];

      if (
        ref.current &&
        event.target instanceof HTMLElement &&
        !ref.current.contains(event.target) &&
        !prohibitedClassNames.includes(event.target.className)
      ) {
        onClick(event);
      }
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [ref, onClick]);

  return ref;
}
