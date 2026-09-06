import { Input, type InputProps } from '@/coop-ui/Input';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

export type PasswordInputProps = Omit<InputProps, 'type' | 'endSlot'>;

/**
 * A password field with a show/hide toggle — the coop-ui replacement for
 * antd's `Input.Password`. Uses the base `Input`'s `endSlot` for the toggle.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        endSlot={
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="flex items-center px-3 text-gray-400 hover:text-gray-600 border border-l-0 border-gray-200 rounded-r-lg bg-white"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        }
      />
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
