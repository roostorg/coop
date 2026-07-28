import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

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
      commonjs(),
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
