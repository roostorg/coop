import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), svgr(), tsconfigPaths(), commonjs()],
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
    // Vite rejects requests whose Host header isn't on its allowlist (a
    // DNS-rebinding protection, on by default since Vite 5) -- this breaks
    // the dev server behind any reverse proxy that forwards a different
    // hostname than localhost (Coder workspace subdomains, ngrok, tailscale
    // funnel, etc). Opt-in via env var so plain `npm start`/local dev is
    // unaffected and this stays a no-op unless a proxying setup opts in.
    allowedHosts: process.env.VITE_DEV_ALLOWED_HOSTS === 'true' ? true : undefined,
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
