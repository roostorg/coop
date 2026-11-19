// Node module hooks that run the server's TypeScript sources directly, for
// tests that spawn a child process: `node --import <this file> <entry>.ts`.
// Node strips this file's own types; everything it loads afterwards is
// transpiled with the TypeScript compiler, which (unlike Node's type
// stripping) drops imports that are only used as types.
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Source files import siblings as `./x.js`; point those at `./x.ts`.
    if (
      specifier.startsWith('.') &&
      specifier.endsWith('.js') &&
      context.parentURL?.startsWith('file:')
    ) {
      const tsUrl = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from module resolution, not user input
      if (existsSync(fileURLToPath(tsUrl))) {
        return nextResolve(tsUrl.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.ts')) {
      return nextLoad(url, context);
    }
    const { outputText } = ts.transpileModule(
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from module resolution, not user input
      readFileSync(fileURLToPath(url), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: fileURLToPath(url),
      },
    );
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});
