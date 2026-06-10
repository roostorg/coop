import { vi } from 'vitest';

global.jest = vi as any;

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
