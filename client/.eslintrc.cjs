const restrictedSyntax = [
  {
    selector:
      ':matches(TSTypeAliasDeclaration[id.name=Props], TSInterfaceDeclaration[id.name=Props])',
    message:
      'React types for props should be inlined',
  },
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
];

module.exports = {
  extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    '.eslintrc.cjs',
    'eslint',
    'tailwind.config.js',
    '*.stories.tsx',
    'vite.config.ts',
    'vite-env.d.ts'
  ],
  plugins: ['@typescript-eslint', 'custom-rules'],
  rules: {
    // TODO: re-enable as 'error' and fix violations in follow-up PR
    '@typescript-eslint/switch-exhaustiveness-check': ['warn'],
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/set-state-in-render': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/use-memo': 'off',
    'react-hooks/static-components': 'off',
    'react/jsx-key': [1, { checkFragmentShorthand: true }],
    'id-denylist': [
      'error',
      'any',
      'Number',
      'number',
      'String',
      'string',
      'Boolean',
      'boolean',
      'Undefined',
      'undefined',
    ],
    'no-caller': ['error'],
    'no-cond-assign': ['error'],
    'no-invalid-regexp': ['error'],
    'no-control-regex': ['error'],
    'no-regex-spaces': ['error'],
    'no-empty-character-class': ['error'],
    'no-misleading-character-class': ['error'],
    'no-delete-var': ['error'],
    'no-empty-pattern': ['error'],
    'no-duplicate-case': ['error'],
    'no-extend-native': ['error'],
    'no-extra-bind': ['error'],
    'no-label-var': ['error'],
    'no-func-assign': ['error'],
    'no-iterator': ['error'],
    'no-lone-blocks': ['error'],
    'no-loop-func': 'error',
    'no-multi-str': ['error'],
    'no-native-reassign': 'error',
    'no-unsafe-finally': ['error'],
    'no-compare-neg-zero': ['error'],
    'no-new-object': ['error'],
    'no-new-symbol': ['error'],
    'no-new-wrappers': ['error'],
    'no-octal': ['error'],
    'no-octal-escape': ['error'],
    'no-self-compare': ['error'],
    'no-sequences': ['error'],
    'no-shadow-restricted-names': ['error'],
    // TODO: re-enable as 'error' and fix violations in follow-up PR
    'no-restricted-syntax': ['warn', ...restrictedSyntax],
    // TODO: re-enable as 'error' and fix violations in follow-up PR
    'no-restricted-imports': [
      'warn',
      {
        paths: [
          {
            name: '@apollo/client',
            importNames: ['useQuery', 'useMutation'],
            message:
              "Please do not use 'useQuery' or 'useMutation' from '@apollo/client'. Instead, use the generated hooks specific to your query or mutation.",
          },
          {
            name: 'lodash',
            message:
              "Please do not import the entire lodash library. Instead, directly import the function you need. For example, use 'import get from 'lodash/get'`.",
          },
          {
            name: '@ant-design/icons',
            message:
              'AntDesign icons are now deprecated in our codebase. Please use line icons instead.',
          },
          {
            name: '@/icons',
            message:
              'This import path is deprecated. Please use lucide-react icons instead.',
          },
        ],
        patterns: ['@/icons/*'],
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'open',
        message:
          'Use an <a> tag to open links, rather than window.open.',
      },
      {
        object: '_',
        property: 'extend',
        message:
          'Use the built-in Object.assign function, or the spread operator, instead.',
      },
      {
        object: '_',
        property: 'reduce',
        message: 'Use the built-in reduce() method on arrays instead.',
      },
    ],
    'no-console': ['error'],
    'no-sparse-arrays': ['error'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-for-in-array': ['error'],
    '@typescript-eslint/promise-function-async': ['error'],
    '@typescript-eslint/return-await': ['error'],
    '@typescript-eslint/no-dynamic-delete': ['error'],
    '@typescript-eslint/only-throw-error': ['error'],
    'no-prototype-builtins': ['error'],
    'no-implicit-coercion': ['error'],
    '@typescript-eslint/no-explicit-any': ['warn'],
    '@typescript-eslint/no-deprecated': ['warn'],
    '@typescript-eslint/no-extra-non-null-assertion': ['error'],
    '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
    '@typescript-eslint/prefer-includes': ['error'],
    // TODO: re-enable as 'error' and fix violations in follow-up PR
    '@typescript-eslint/prefer-nullish-coalescing': [
      'warn',
      { ignoreTernaryTests: true, ignoreMixedLogicalExpressions: true },
    ],
    '@typescript-eslint/no-namespace': ['error'],
    'no-ex-assign': ['error'],
    'prefer-const': ['error'],
    'no-unneeded-ternary': ['error'],
    'no-eval': ['error'],
    'no-new-func': ['error'],
    'no-script-url': 'error',
    '@typescript-eslint/no-implied-eval': ['error'],
    '@typescript-eslint/default-param-last': ['error'],
    '@typescript-eslint/no-useless-constructor': ['error'],
    '@typescript-eslint/prefer-function-type': ['error'],
    'prefer-object-spread': ['error'],
    'object-shorthand': ['error'],
    'no-useless-rename': ['error'],
    'no-useless-computed-key': ['error'],
    'no-useless-catch': ['error'],
    'no-undef-init': ['error'],
    'no-debugger': ['warn'],
    // Handled better by Typescript's noFallthroughCasesInSwitch config option,
    // which knows if a function returns never.
    'no-fallthrough': ['off'],
    '@typescript-eslint/no-non-null-asserted-optional-chain': ['error'],
    'no-return-assign': ['error', 'always'],
    'no-new': ['error'],
    'custom-rules/no-casting-in-getFieldValueForRole': ['error'],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
