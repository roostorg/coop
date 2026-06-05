import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidUrl(value: string) {
  if (!value) return true;
  return URL.canParse(value);
}

export function validateJSON(value: string | undefined) {
  if (!value || value.length === 0) {
    return true;
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed != null;
  } catch {
    return false;
  }
}
