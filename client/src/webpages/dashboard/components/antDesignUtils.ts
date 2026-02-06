import type { DefaultOptionType } from 'antd/lib/select';

/**
 * Some <Select /> components have a filter option that allows users to filter
 * by a custom value rather than by the `value` prop in each <Option />. A
 * common case is when the `value` prop of each <Option /> is an ID, but the
 * `label` of each <Option /> is a human-readable name, obfuscating the ID.
 *
 * This util function should be passed into the `filterOption` prop of the
 * <Select /> component when you want the user's search string to match against either
 * the `label` prop of each <Option />, rather than the `value` prop.
 *
 * NB: You *must* include the `label` prop in each <Option /> for this to work.
 */
export const selectFilterByLabelOption = (
  input: string,
  option: DefaultOptionType | undefined,
) => {
  if (option == null) {
    return true;
  }
  return String(option.label).toLowerCase().includes(input.toLowerCase());
};
