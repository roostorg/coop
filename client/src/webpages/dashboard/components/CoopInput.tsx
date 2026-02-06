import type { HTMLInputTypeAttribute } from 'react';

export default function CoopInput(props: {
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  value?: string;
}) {
  const { placeholder, onChange, disabled } = props;
  return (
    <input
      className="block w-full px-3 py-2 ring-2 text-base border-gray-200 border-solid rounded ring-gray-200 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none"
      placeholder={placeholder}
      onChange={onChange}
      disabled={disabled}
      value={props.value ?? ''}
    />
  );
}
