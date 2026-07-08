import type { HTMLInputTypeAttribute } from 'react';

export default function CoopInput(props: {
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  value?: string;
  error?: boolean;
}) {
  const { type, placeholder, onChange, disabled, value, error } = props;
  return (
    <input
      className={`block w-full px-3 py-2 ring-2 text-base border-solid rounded placeholder:text-gray-500 disabled:opacity-50 disabled:pointer-events-none ${
        error
          ? 'border-red-400 ring-red-400 focus:border-red-400 focus:ring-red-400/20'
          : 'border-gray-200 ring-gray-200 focus:border-primary focus:ring-primary/20'
      }`}
      type={type}
      placeholder={placeholder}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={error}
      value={value ?? ''}
    />
  );
}
