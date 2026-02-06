import { useCallback, useEffect, useRef, useState } from 'react';

import TextToken from '../../webpages/dashboard/components/TextToken';

export default function CoopSelect<T extends string>(props: {
  options: {
    value: T;
    label: string;
  }[];
  mode?: 'single' | 'multiselect';
  placeholder?: string;
  disabled?: boolean;
  value?: T | T[];
  onSelect?: (value: T) => void;
  onDeselect?: (value: T) => void;
  openDropdown?: () => void;
  onDropdownVisibleChange?: (visible: boolean) => void;
  openDropdownKeyBinding?: Exclude<
    string,
    'Escape' | 'Enter' | 'ArrowUp' | 'ArrowDown'
  >;
}) {
  const {
    options,
    mode = 'single',
    placeholder,
    disabled = false,
    value,
    onSelect,
    onDeselect,
    onDropdownVisibleChange,
    openDropdownKeyBinding,
  } = props;

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<T[]>(
    !value ? [] : Array.isArray(value) ? value : [value],
  );
  const [focusedOption, setFocusedOption] = useState<T | undefined>(undefined);
  const [searchString, setSearchString] = useState<string | undefined>(
    undefined,
  );

  const componentRef = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);

  const onClick = () => {
    if (disabled) {
      return;
    }
    if (inputEl.current != null) {
      inputEl.current.focus();
    }
    setIsMenuVisible(true);
  };

  const toggleOption = useCallback(
    (val: T) => {
      setSelectedOptions((prev) => {
        if (mode === 'single') {
          setIsMenuVisible(false);
        }

        if (prev.includes(val)) {
          if (onDeselect) {
            onDeselect(val);
          }
          return prev.filter((it) => it !== val);
        } else {
          if (onSelect) {
            onSelect(val);
          }
          return [...prev, val];
        }
      });
      setSearchString(undefined);
    },
    [mode, onDeselect, onSelect],
  );

  // Scroll to an option when it's focused
  useEffect(() => {
    if (isMenuVisible && focusedOption) {
      const menuElement = document.getElementById('menu');
      const optionElement = document.getElementById(focusedOption);
      if (!menuElement || !optionElement) {
        return;
      }
      const menuRect = menuElement.getBoundingClientRect();
      const optionRect = optionElement.getBoundingClientRect();
      const isOptionVisible =
        optionRect.top >= menuRect.top &&
        optionRect.bottom <= menuRect.bottom &&
        optionRect.left >= menuRect.left &&
        optionRect.right <= menuRect.right;

      // Check if the component is not fully in view
      if (!isOptionVisible) {
        optionElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
    }
  }, [isMenuVisible, focusedOption]);

  useEffect(() => {
    if (isMenuVisible) {
      setFocusedOption(options[0].value);
    }
    if (onDropdownVisibleChange) {
      onDropdownVisibleChange(isMenuVisible);
    }
    // Only run this when isMenuVisible changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuVisible]);

  useEffect(() => {
    setSelectedOptions(!value ? [] : Array.isArray(value) ? value : [value]);
  }, [value]);

  // Close the menu on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        componentRef.current &&
        !componentRef.current.contains(event.target as Node)
      ) {
        if (isMenuVisible) {
          setIsMenuVisible(false);
        }
      }
    };

    if (isMenuVisible) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isMenuVisible, options]);

  // Close the menu when Escape is pressed
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disabled) {
        return;
      }
      if (!isMenuVisible) {
        if (event.key === openDropdownKeyBinding) {
          setIsMenuVisible(true);
          event.preventDefault();
          inputEl.current?.focus();
        }
        return;
      }
      if (event.key === 'Escape') {
        setIsMenuVisible(false);
        inputEl.current?.blur();
      }
      if (focusedOption) {
        if (event.key === 'Enter') {
          toggleOption(focusedOption);
        } else {
          const index = options.findIndex((op) => op.value === focusedOption);
          if (event.key === 'ArrowUp') {
            if (index === 0) {
              setFocusedOption(options[options.length - 1].value);
            } else {
              setFocusedOption(options[index - 1].value);
            }
          } else if (event.key === 'ArrowDown') {
            if (index === options.length - 1) {
              setFocusedOption(options[0].value);
            } else {
              setFocusedOption(options[index + 1].value);
            }
          }
        }
      }
    };

    // Add the event listener when the component mounts
    window.addEventListener('keydown', handleKeyPress);

    // Remove the event listener when the component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [
    disabled,
    focusedOption,
    isMenuVisible,
    openDropdownKeyBinding,
    options,
    toggleOption,
  ]);

  return (
    <div
      className={`inline-block relative py-1 px-2 rounded border border-solid focus:border-coop-blue ${
        isMenuVisible ? 'border-coop-blue' : 'border-slate-200'
      } ${
        disabled
          ? 'bg-slate-50 cursor-not-allowed'
          : 'bg-white hover:border-coop-blue cursor-text'
      }`}
      onClick={onClick}
      ref={componentRef}
      style={{ minWidth: 'max-content' }}
    >
      <div className="flex flex-wrap w-fit">
        {selectedOptions.map((option, idx) => {
          return (
            <TextToken
              title={options.find((it) => it.value === option)!.label}
              key={idx}
              onDelete={() => toggleOption(option)}
              disabled={disabled ?? false}
            />
          );
        })}
      </div>
      {
        // If the mode is multiselect or if it's single but there is no
        // selected option yet, show the input
        (mode === 'multiselect' || selectedOptions.length === 0) && (
          <input
            className="w-full bg-transparent border-none outline-none ring-0 focus:border-none focus:ring-0 active:border-none active:ring-0 hover:border-none focus-visible:outline-none placeholder:text-gray-300"
            type="text"
            onKeyDown={(event) => {
              if (
                event.key === 'Backspace' &&
                !searchString?.length &&
                selectedOptions.length > 0
              ) {
                toggleOption(selectedOptions[selectedOptions.length - 1]);
              }
            }}
            onChange={(event) => setSearchString(event.target.value)}
            placeholder={
              selectedOptions.length > 0 || placeholder == null
                ? ''
                : placeholder
            }
            ref={inputEl}
            value={searchString}
            disabled={disabled}
          />
        )
      }
      {isMenuVisible ? (
        <div
          id="menu"
          className="absolute z-20 flex flex-col max-h-[256px] overflow-y-scroll bg-white left-0 border-slate-200 border border-solid shadow mt-3"
        >
          {options
            .filter(
              (option) =>
                !searchString ||
                option.label
                  .toLocaleLowerCase()
                  .includes(searchString.toLocaleLowerCase()),
            )
            .map((option) => (
              <div
                key={option.value}
                id={option.value}
                className={`px-2 py-1 text-start cursor-pointer text-slate-500 ${
                  selectedOptions.includes(option.value)
                    ? 'bg-coop-lightblue'
                    : focusedOption === option.value
                    ? 'bg-slate-100'
                    : 'bg-white'
                } hover:bg-coop-lightblue-hover whitespace-nowrap`}
                onClick={() => toggleOption(option.value)}
              >
                {option.label}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
