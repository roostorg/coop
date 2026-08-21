/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = dirname(fileURLToPath(import.meta.url));

const allowedHosts = (process.env.VITE_DEV_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((v) => !!v);

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const reactCompilerConfig = {
    compilationMode: 'annotation',
    target: '18',
    panicThreshold: isProduction ? 'none' : 'critical_errors',
    logger: {
      logEvent(filename: string | null, event: { kind: string }) {
        if (!isProduction && event.kind === 'CompileError') {
          console.error(
            `[React Compiler] Skipped ${filename ?? 'unknown file'}`,
          );
        }
      },
    },
  };

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', reactCompilerConfig]],
        },
      }),
      svgr(),
      tsconfigPaths(),
    ],
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
      // Set to a comma-separated list of hostnames if needed, using a leading
      // dot to specify subdomain wildcards, e.g. '.example.com' to allow all
      // subdomains of example.com
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
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
  };
});
