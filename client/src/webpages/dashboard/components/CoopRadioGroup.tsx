import { useState } from 'react';

export default function CoopRadioGroup(props: {
  options: {
    label: string;
    value: string;
    disabled?: boolean;
  }[];
  layout?: 'horizontal' | 'vertical';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { options, layout = 'vertical', onChange } = props;
  const [checkedOptionValue, setCheckedOptionValue] = useState<
    string | undefined
  >(undefined);

  return (
    <div className={`flex gap-3 ${layout === 'vertical' ? 'flex-col' : ''}`}>
      {options.map((option, i) => (
        <div key={i} className="flex items-center">
          <input
            id={option.value}
            type="radio"
            className="shrink-0 mt-0.5 border-solid border-gray-200 rounded-full text-primary focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none"
            value={option.value}
            checked={option.value === checkedOptionValue}
            onChange={(event) => {
              if (onChange) {
                onChange(event);
              }
              setCheckedOptionValue(event.target.value);
            }}
            disabled={option.disabled}
          />
          <label
            htmlFor={option.value}
            className={`font-medium ms-2 ${
              option.disabled ? 'text-gray-300' : 'text-black'
            }`}
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}
