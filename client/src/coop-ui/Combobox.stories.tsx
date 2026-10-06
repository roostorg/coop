import {
  Combobox,
  MultiCombobox,
  type ComboboxOption,
} from '@/coop-ui/Combobox';
import { Meta } from '@storybook/react';
import { useState } from 'react';

export default {
  title: 'Components/Combobox',
  component: Combobox,
} as Meta<typeof Combobox>;

const frameworks: ComboboxOption[] = [
  { value: 'next', label: 'Next.js' },
  { value: 'svelte', label: 'SvelteKit' },
  { value: 'nuxt', label: 'Nuxt.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
];

export const Single = () => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <div className="w-64">
      <Combobox
        options={frameworks}
        value={value}
        onValueChange={setValue}
        placeholder="Select framework…"
        allowClear
      />
    </div>
  );
};

export const Multi = () => {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div className="w-64">
      <MultiCombobox
        options={frameworks}
        value={value}
        onValueChange={setValue}
        placeholder="Select frameworks…"
        allowClear
      />
    </div>
  );
};
