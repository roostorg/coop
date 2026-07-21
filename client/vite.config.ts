/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), svgr(), tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Redirect `recharts-scale/es6/getNiceTickValues` through our wrapper so
      // we can recover from upstream's DecimalError "Division by zero" on
      // degenerate chart domains. See `src/rechartsScaleWrapper.js`.
      'recharts-scale/es6/getNiceTickValues': path.resolve(
        __dirname,
        './src/rechartsScaleWrapper.js',
      ),
    },
  },
  build: {
    outDir: 'build',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});
