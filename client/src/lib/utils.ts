import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidUrl(value: string) {
  if (!value) return true;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateJSON(value: string | undefined) {
  if (!value || value.length === 0) {
    return true;
  }
  try {
    const parsed = JSON.parse(value);
    // These fields map to a GraphQL JSONObject (key-value map), so arrays and
    // primitives are not valid even though `typeof [] === 'object'`.
    return (
      typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}
