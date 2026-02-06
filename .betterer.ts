import { BettererFileTest } from '@betterer/betterer';
import { eslint } from '@betterer/eslint';

export default {
  'No CSS Stylesheets': () =>
    countCssStylesheets().include('./client/**/*.css'),
  'No explicit any in client': () =>
    eslint({
      '@typescript-eslint/no-explicit-any': 'error',
    }).include('./client/**/*.{ts,tsx}'),
  'No explicit any in server': () =>
    eslint({
      '@typescript-eslint/no-explicit-any': 'error',
    }).include('./server/**/*.{ts,cts}'),
  'No Deprecated API usage': () =>
    eslint({ 'etc/no-deprecated': 'error' }).include('./client/**/*.{ts,tsx}'),
  'No counterproductive type annotations': () =>
    eslint({
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression:not(:has(.callee[name="useCallback"], .callee[name="useEffect"], .callee[name="useMemo"])) .arguments:matches(ArrowFunctionExpression) .params[typeAnnotation]:matches([name!="e"])',
          message:
            "When a function `x` is written inline and passed as an argument, it's " +
            "usually better not to write explicit type annotations on `x`'s " +
            'arguments because the argument types should be able to be inferred, ' +
            "and the inferred type will usually be more accurate than what you'd " +
            'write manually. Plus, the inferred type will automatically update.\n\n' +
            "If the type for x's arguments is not being correctly inferred, that " +
            'suggests an issue with the type definition of the function that `x` is ' +
            'being passed to.',
        },
      ],
    }).include('./client/**/*.{ts,tsx}'),
  'No new ant-design icon imports': () =>
    eslint({
      'no-restricted-imports': [
        'error',
        {
          name: '@ant-design/icons',
          message:
            'AntDesign icons are now deprecated in our codebase. Please use line icons instead.',
        },
      ],
    }).include('./client/**/*.{ts,tsx}'),
  'No new line-icon imports': () =>
    eslint({
      'no-restricted-imports': [
        'error',
        {
          paths: ['@/icons'],
          patterns: ['@/icons/*'],
        },
      ],
    }).include('./client/**/*.{ts,tsx}'),
};

function countCssStylesheets() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    filePaths.forEach((filePath) => {
      const file = fileTestResult.addFile(filePath, '');
      file.addIssue(
        0,
        0,
        'Please replace CSS stylesheets with inline Tailwind.css',
      );
    });
  });
}
