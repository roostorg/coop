const fs = require('node:fs');
const path = require('node:path');

/******************************************************************************
 * If you need to write one of these selectors, use
 * https://typescript-eslint.io/play/
 *
 * Click on the "ESTree" tab and enter your selector in the "ESQuery filter" box.
 * These selectors, which are [esquery](https://github.com/estools/esquery)
 * queries, have a somewhat underdocumented and confusing syntax, so that
 * playgroudn is clutch.
 ******************************************************************************/

const gqlTypeUsageSelector =
  'ImportDeclaration[source.value=/generated\\.js$/]';

const jsonParseStringifySelector =
  'MemberExpression[object.type="Identifier"][object.name="JSON"][property.type="Identifier"]:matches([property.name="parse"],[property.name="stringify"])';

const uniqWithSelector = 'CallExpression[callee.name="uniqWith"]';

const logJsonSelector = 'CallExpression[callee.name="logJson"]';

const logErrorJsonSelector = 'CallExpression[callee.name="logErrorJson"]';

const unmanagedSequelizeTransactionSelector =
  'CallExpression[arguments.length=0] > MemberExpression[property.name="transaction"][object.name!=/pgQuery|snowflake|kysely|pg/][object.object.type!="ThisExpression"]';

const badHttpClientsImportSelector =
  'ImportDeclaration[source.value=/^(axios|node-fetch)$/]';
const badHttpClientUseSelector = 'CallExpression[callee.name="fetch"]';

const restrictedSyntax = [
  {
    selector: 'ForInStatement',
    message:
      'for-in loops can behave unexpectedly. If used on an array, the author ' +
      'is usually hoping to get each value, but for-in loops always iterates ' +
      'over the keys. On objects, meanwhile, for-in loops can be bug-prone ' +
      'because they the prototype chain to find keys, which can lead to ' +
      'unexpected keys being included, and makes the code vulnerable to bugs ' +
      'from seemingly-unrelated changes potentially far away in the source.',
  },
  {
    selector: 'WithStatement',
    message:
      'the with statement enables dynamic scoping, which can have some cool, ' +
      'niche use cases, but generally causes much more trouble and confusion ' +
      'than its worth (which is why the vast majority of programming languages ' +
      'now use static/lexical scoping). Meanwhile, the with statement is entirely ' +
      "disallowed in JS' strict mode, which is required in order to use modern JS " +
      'features, making this mostly a moot point.',
  },
  {
    selector: 'VariableDeclaration[kind="var"]',
    message:
      'The var keyword can always be replaced with const (preferably) or let ' +
      '(if you really need mutability), and the resulting code will be less ' +
      'confusing, as var has some much-discussed quirks around scoping and hoisting.',
  },
  {
    selector: logJsonSelector,
    message:
      'This helper is only intended to be used when a SafeTracer is not available, e.g. during app startup before it has been initialized.',
  },
  {
    selector: logErrorJsonSelector,
    message:
      'This helper is only intended to be used when a SafeTracer is not available, e.g. during app startup before it has been initialized.',
  },
  {
    selector: gqlTypeUsageSelector,
    message:
      'Our services "layer" is meant to contain business logic in a way that\'s ' +
      'independent of the transport medium (such that, e.g., we could) equally easily ' +
      'invoke this logic in an HTTP/REST endpoint, a GQL request, a GRPC call, etc. ' +
      "Accordingly, this layer shouldn't take a dependency on GQL-specific types. " +
      'Note that, if you need to pass a GQL enum into this layer, you can use ' +
      'makeEnumLike() to get a variable (from which you can derive a type) ' +
      'that the generated GQL enum type will be assignable to, assuming the keys actually match.',
  },
  {
    selector: jsonParseStringifySelector,
    message:
      'Instead of using `JSON.parse` and `JSON.stringify`, use the ' +
      '`jsonParse` and `jsonStringify` helper functions. `jsonStringify` is ' +
      'specially designed to preserve type information when a value is ' +
      "converted to JSON, so that TS will know the original type if it's " +
      'later parsed back with `jsonParse` (within the same program). I.e., ' +
      'both `x` and `jsonParse(jsonStringify(x))` will have the same TS type, ' +
      'whereas, with `JSON.parse(JSON.stringify(x))` will have type `any`: ' +
      'all of the type information about `x` will have been lost, and, worse, ' +
      'an unsafe `any` (as opposed to safe `unknown`) will have been ' +
      'introduced. Using jsonParse also returns a type -- JsonOf<T> -- that ' +
      'makes it possible to build APIs that accept/return strings of JSON, ' +
      'where the contents in the JSON must match `T` when parsed.',
  },
  {
    selector: unmanagedSequelizeTransactionSelector,
    message:
      'Instead of using an unmanaged Sequelize transactions and having to commit ' +
      'or rollback the transaction manually, wrap the queries in a callback and pass ' +
      "it into the transaction function instead. Managed transactions don't require us " +
      'to thread the transaction through all possibly deeply nested queries which helps ' +
      'prevent potential bugs. You can find more details here:' +
      'https://sequelize.org/docs/v6/other-topics/transactions/',
  },
  {
    selector: badHttpClientsImportSelector,
    message:
      "Instead of using axios or node-fetch, use Node's implementation of the standard fetch API." +
      'This avoids the need to install unnecessary third-party packages, and should ' +
      'have better performance than any of the third-party alternatives. It also means ' +
      'that developers who have experience with the fetch API in browsers will already be ' +
      'familiar with this, rather than having to learn a new library or module. For more' +
      'information, see here: https://blog.logrocket.com/fetch-api-node-js/',
  },
  {
    selector: badHttpClientUseSelector,
    message:
      'Instead of using fetch, use the injectable dependency fetchHTTP from ' +
      'the networking service. Using this helper instead of raw fetch makes it ' +
      'much easier to mock because the API is much more constrained, allows us ' +
      'to instrument our outgoing network requests in one place, and abstract ' +
      'away some of the nonsense with the fetch API',
  },
  {
    selector: uniqWithSelector,
    message:
      '`uniqWith` can be incredibly slow -- mostly because the logic is ' +
      'fundamentally quadratic (i.e., every element in the array is compared ' +
      'with every unique element found so far), but also because of aspects ' +
      "of lodash's particular implementation. Please avoid it, and construct " +
      "a 'key' for each item that you can use with `uniqBy` instead, if at " +
      'all possible. (See the codebase for examples.)',
  },
];

/**
 * These rules flag bug- or error-prone patterns and code that might trip up
 * readers. This includes code that may indicate a misunderstanding on the part
 * of the author, or code that may not be sufficiently defensive. These patterns
 * don't always indicate a bug, but they're a mistake enough of the time -- or
 * at least indicate something potentially unexpected that should be flagged for
 * the reader (as in no-cond-assign) -- that we want all usages of them to be
 * considered and to come with eslint-disable comments when they are used. Rules
 * here should be applicable to all platforms (i.e., Node, browsers, etc).
 */
const correctnessRules = {
  'array-callback-return': ['error'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
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
  'no-global-assign': ['error'],
  'no-iterator': ['error'],
  'no-lone-blocks': ['error'],
  'no-loop-func': 'error',
  'no-multi-str': ['error'],
  'no-native-reassign': 'error',
  'no-unsafe-negation': ['error', { enforceForOrderingRelations: true }],
  'no-unsafe-finally': ['error'],
  'no-compare-neg-zero': ['error'],
  'no-new-object': ['error'],
  'no-new-symbol': ['error'],
  'no-new-wrappers': ['error'],
  'no-octal': ['error'],
  'no-octal-escape': ['error'],
  'no-self-assign': ['error', { props: true }],
  'no-self-compare': ['error'],
  'no-sequences': ['error'],
  'no-shadow-restricted-names': ['error'],
  'no-sparse-arrays': ['error'],
  '@typescript-eslint/no-for-in-array': ['error'],
  'no-prototype-builtins': ['error'],
  'no-implicit-coercion': ['error'],
  'use-isnan': [
    'error',
    { enforceForSwitchCase: true, enforceForIndexOf: true },
  ],
  'no-async-promise-executor': ['error'],
  'no-void': ['error'],
  '@typescript-eslint/no-throw-literal': ['error'],
  '@typescript-eslint/no-unused-expressions': [
    'error',
    { allowTaggedTemplates: true, allowShortCircuit: true },
  ],
  '@typescript-eslint/no-misused-promises': [
    'error',
    { checksVoidReturn: false },
  ],
  '@typescript-eslint/no-floating-promises': ['error'],
  '@typescript-eslint/promise-function-async': ['error'],
  '@typescript-eslint/return-await': ['error'],
  '@typescript-eslint/no-dynamic-delete': ['error'],
  '@typescript-eslint/ban-types': [
    'error',
    {
      extendDefaults: false,
      types: {
        String: {
          message: 'Use string instead',
          fixWith: 'string',
        },
        Boolean: {
          message: 'Use boolean instead',
          fixWith: 'boolean',
        },
        Number: {
          message: 'Use number instead',
          fixWith: 'number',
        },
        Symbol: {
          message: 'Use symbol instead',
          fixWith: 'symbol',
        },
        Function: {
          message: [
            'The `Function` type accepts any function-like value -- it provides no type safety when calling the function.',
            'It also accepts things like class declarations, which will throw at runtime as they will not be called with `new`.',
            'If you are expecting the function to accept certain arguments, you should explicitly define the function shape.',
          ].join('\n'),
        },
        Object: {
          message: [
            'The `Object` type actually means "any non-nullish value", so it is marginally better than `unknown`.',
            '- If you want a type meaning "any object", you probably want `object` or `Record<string, unknown>` instead.',
            '- If you want a type meaning "any value", you probably want `unknown` instead.',
          ].join('\n'),
          fixWith: 'object',
        },
        '{}': {
          message: [
            '`{}` actually means "any non-nullish value".',
            '- If you want a type meaning "any object", you probably want `object` or `Record<string, unknown>` instead.',
            '- If you want a type meaning "any value", you probably want `unknown` instead.',
          ].join('\n'),
        },
      },
    },
  ],
  '@typescript-eslint/no-extra-non-null-assertion': ['error'],
  '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
  // TODO: enable this soon
  // '@typescript-eslint/no-explicit-any': ['error'],
  '@typescript-eslint/no-non-null-asserted-optional-chain': ['error'],
  '@typescript-eslint/prefer-includes': ['error'],
  '@typescript-eslint/prefer-nullish-coalescing': ['error'],
  '@typescript-eslint/no-namespace': ['error'],
  'import/no-extraneous-dependencies': [
    'error',
    {
      devDependencies: [
        '**/test/**',
        '**/*.{spec,test}.{ts,tsx,js}',
        '.storybook/**',
        '**/*.stories.tsx',
        '**/bin/**',
      ],
    },
  ],
  'import/no-deprecated': ['error'],
  // etc/no-deprecated catches many more errors than import/no-deprecated.
  'etc/no-deprecated': ['error'],
  // Empty interfaces usually indicate a misunderstanding of TS (i.e., expecting
  // the interface to be nominal rather than structural.)
  '@typescript-eslint/no-empty-interface': ['error'],
  'switch-statement/require-appropriate-default-case': ['error'],
  '@typescript-eslint/restrict-plus-operands': [
    'error',
    {
      allowAny: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumberAndString: false,
      allowRegExp: false,
      skipCompoundAssignments: false,
    },
  ],
};

const servicesDir = path.join(__dirname, 'services');
const serviceNames = fs
  .readdirSync(servicesDir)
  .filter((file) => fs.statSync(path.join(servicesDir, file)).isDirectory());

/**
 * These rules flag patterns helping with maintainability, readability, and
 * preventing overly long or complex code. Rules here should be applicable to
 * all platforms (i.e., Node, browsers, etc).
 */
const maintainabilityReadabilityRules = {
  complexity: ['error'],
  'max-classes-per-file': ['error', 2],
  'max-lines': ['error', 500],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { fixStyle: 'inline-type-imports' },
  ],
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: [
            './services',
            './snowflake',
            './routes',
            './rule_engine',
            './workers_jobs',
            './utils',
          ],
          from: './graphql',
          message:
            "Code outside the graphql folder is meant to hold logic that's " +
            'transport-agnostic (i.e., that could be exposed over GraphQL, ' +
            'standard REST endpoints, or in some other way). Therefore, code ' +
            'in these folders should not depend on any functions or types in ' +
            'the graphql folder, which is meant to contain code/types ' +
            'specific to exposing this functionality over GQL.',
        },
        ...serviceNames.map((it) => ({
          target: ['!(services)/**/*', `services/(!${it})/**/*`],
          from: [`./services/${it}`],
          except: [`index.js`, `index.ts`],
          message:
            'Each service exposes its public exports through an index file, ' +
            'so consumers of the service must only import from that file. ' +
            'See rationale in https://github.com/roostorg/coop/pull/1643',
        })),
      ],
    },
  ],
  // 'etc/no-t': ['error'], enable?
};

/**
 * Rules that would make sense but are disabled because TS handles them better.
 * Rules here should be applicable to all platforms (i.e., Node, browsers, etc).
 */
const replacedByTSRules = {
  'no-unreachable': ['off'],
  strict: ['off'],
  'getter-return': ['off'],
  'no-undef': ['off'],
  'constructor-super': ['off'],
  'no-fallthrough': ['off'],
};

module.exports = {
  extends: ['plugin:security/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    '*.d.ts',
    '.eslintrc.cjs',
    '.eslintformat.js',
    'transpiled/',
    'coverage/',
  ],
  plugins: [
    'node',
    'promise',
    '@typescript-eslint',
    'jsdoc',
    'import',
    'etc',
    'better-mutation',
    'switch-statement',
  ],
  rules: {
    // Disable overly-naggy/inappropriate rules from the configs we extend.
    'security/detect-object-injection': ['off'],

    ...correctnessRules,
    'no-restricted-syntax': ['error', ...restrictedSyntax],
    'no-restricted-properties': [
      'error',
      { object: 'document', property: 'domain' },
      { object: 'document', property: 'write' },
      { object: 'window', property: 'setImmediate' },
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
      {
        object: '_',
        property: 'last',
        message: 'Use the built-in `at(-1)` method on arrays instead.',
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // Enforce rules that embody our code style principles
    // (e.g., around reducing mutability)
    'no-ex-assign': ['error'],
    'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
    'prefer-const': ['error'],
    'no-new': ['error'],
    'no-return-assign': ['error', 'always'],
    'no-unneeded-ternary': ['error'],
    'no-console': ['error'],

    // Enable rules to catch potential security risks
    'no-eval': ['error'],
    'no-new-func': ['error'],
    'no-script-url': 'error',
    '@typescript-eslint/no-implied-eval': ['error'],

    ...maintainabilityReadabilityRules,

    // Require correct documentation, while forbidding JSDocs from containing
    // info that's already encoded in Typescript (and might just come out of
    // sync in the docblock). Disabled for now...
    // "jsdoc/require-jsdoc": [
    //   "error",
    //   {
    //     publicOnly: true,
    //     require: {
    //       ClassDeclaration: true,
    //       ClassExpression: true,
    //       MethodDefinition: false,
    //       FunctionDeclaration: true,
    //       FunctionExpression: false,
    //       ArrowFunctionExpression: true,
    //     },
    //     contexts: ['MethodDefinition[kind="method"][key.name!=/^(render)$/]'],
    //   },
    // ],
    // "jsdoc/require-description": [
    //   "error",
    //   { checkConstructors: false, checkSetters: false },
    // ],
    // "jsdoc/require-param": ["error", { checkDestructuredRoots: false }],
    // "jsdoc/require-param-name": ["error"],
    // "jsdoc/require-param-description": ["error"],
    // "jsdoc/require-hyphen-before-param-description": ["error"],
    // "jsdoc/require-returns": ["error", { checkGetters: false }],
    // "jsdoc/require-returns-check": ["error"],
    // "jsdoc/require-returns-description": ["error"],
    // "jsdoc/check-param-names": ["error", { checkDestructured: false }],
    // "jsdoc/check-tag-names": ["error"],
    // "jsdoc/check-types": ["error"],
    // "jsdoc/no-bad-blocks": ["error"],
    // "jsdoc/no-defaults": ["error"],
    // "jsdoc/no-types": ["error"],
    // "symbol-description": ["error"],

    // Style rules that are outside the scope of prettier because they
    // actually effect the contents of the AST (not just how it's printed).
    // "@typescript-eslint/naming-convention": [
    //   "error",
    //   {
    //     selector: ["property", "parameterProperty", "method", "accessor"],
    //     format: ["camelCase", "UPPER_CASE"],
    //     leadingUnderscore: "forbid",
    //     trailingUnderscore: "forbid",
    //   },
    //   {
    //     selector: ["typeLike", "enumMember"],
    //     format: ["PascalCase"],
    //   },
    //   {
    //     // Allow PascalCase for react components
    //     selector: ["function"],
    //     format: ["camelCase", "UPPER_CASE", "PascalCase"],
    //     leadingUnderscore: "forbid",
    //     trailingUnderscore: "forbid",
    //   },
    //   {
    //     // Allow _ to indicate unused.
    //     selector: ["parameter", "variable"],
    //     format: ["camelCase", "UPPER_CASE"],
    //     leadingUnderscore: "allow",
    //     trailingUnderscore: "forbid",
    //   },
    // ],
    'prefer-object-spread': ['error'],
    'object-shorthand': ['error'],
    'no-useless-rename': ['error'],
    'no-useless-computed-key': ['error'],
    'no-useless-catch': ['error'],
    'no-undef-init': ['error'],
    yoda: ['error'],
    'no-proto': ['error'],
    '@typescript-eslint/no-inferrable-types': [
      'error',
      { ignoreParameters: true },
    ],
    '@typescript-eslint/default-param-last': ['error'],
    '@typescript-eslint/no-useless-constructor': ['error'],
    '@typescript-eslint/prefer-function-type': ['error'],
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      {
        assertionStyle: 'as',
        // This is actually a type safety check; not just a style check.
        // See https://github.com/typescript-eslint/typescript-eslint/blob/03886d75b5eba0a06d28bd7bbbd30c6a1b2e901c/packages/eslint-plugin/docs/rules/consistent-type-assertions.md
        objectLiteralTypeAssertions: 'allow-as-parameter',
      },
    ],
    '@typescript-eslint/no-extraneous-class': ['error'],
    '@typescript-eslint/no-unnecessary-condition': [
      'error',
      { allowConstantLoopConditions: true },
    ],

    ...replacedByTSRules,

    // Rules we might want to enable eventually, but don't have a use for yet.
    // "no-restricted-globals": ["error"],
    // "no-restricted-imports": ["error"],

    /* Rules to evaluate later.
    "import/no-anonymous-default-export": "error",
    "no-template-curly-in-string": ["error"],
    "no-useless-escape": ["error"],
    "require-yield": "error",
    "unicode-bom": ["error", "never"],
    "valid-typeof": ["error"],
    "import/first": ["error"],
    "@typescript-eslint/no-array-constructor": ["error"],
    "node/handle-callback-err": ["error", "^(err|error)$"],
    "node/no-sync": ["error"],
    "import/no-default-export": ["off"],
    "import/no-internal-modules": ["off"],
    "import/no-unassigned-import": ["off"],
    "import/order": ["off"],
    "no-duplicate-imports": ["error"],
    "no-empty": ["error"],
    "no-invalid-this": ["off"],
    "no-magic-numbers": ["off"],
    "no-null/no-null": ["off"],
    "no-shadow": ["error", { hoist: "all" }],
    radix: ["error"],
    "accessor-pairs": ["error"],
    "handle-callback-err": ["error", "^(err|error)$"],
    "no-case-declarations": ["error"],
    "no-debugger": ["error"],
    "no-extra-boolean-cast": ["error"],
    "no-extra-parens": ["error", "functions"],
    "no-floating-decimal": ["error"],
    "no-inner-declarations": ["error"],
    "no-new-require": ["error"],
    "no-path-concat": ["error"],
    "no-unexpected-multiline": ["error"],
    "no-unmodified-loop-condition": ["error"],
    "no-useless-call": ["error"],
    "prefer-promise-reject-errors": ["error"],
    "wrap-iife": ["error", "any", { functionPrototypeMethods: true }],
    "import/export": ["error"],
    "import/no-absolute-path": [
      "error",
      { esmodule: true, commonjs: true, amd: false },
    ],
    "import/no-duplicates": ["error"],
    "import/no-named-default": ["error"],
    "node/process-exit-as-throw": ["error"],
    "promise/param-names": ["error"],
    "standard/no-callback-literal": ["error"],
    "@typescript-eslint/no-empty-function": ["error"],
    "@typescript-eslint/no-require-imports": ["error"],
    "@typescript-eslint/no-unnecessary-qualifier": ["error"],
    "@typescript-eslint/prefer-namespace-keyword": ["error"],
    "@typescript-eslint/unified-signatures": ["error"],
    "@typescript-eslint/dot-notation": ["error"],
    "@typescript-eslint/array-type": ["error", { default: "array" }],
    "@typescript-eslint/method-signature-style": ["error", "method"],
    "@typescript-eslint/no-base-to-string": ["error"],
    "@typescript-eslint/no-this-alias": ["error"],
    "@typescript-eslint/no-var-requires": ["error"],
    "@typescript-eslint/prefer-reduce-type-parameter": ["error"],
    "@typescript-eslint/prefer-ts-expect-error": ["error"],
    "@typescript-eslint/triple-slash-reference": [
      "error",
      { path: "always", types: "prefer-import", lib: "always" },
    ],
    "no-bitwise": ["error"],
    "no-unneeded-ternary": ["error", { defaultAssignment: false }],
    */
  },
  settings: {
    jsdoc: {
      tagNamePreference: {
        access: {
          message: 'Access modifiers should be defined in TS only.',
        },
      },
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  overrides: [
    {
      // Override primary definition of no-restricted-syntax to allow
      // referencing the GQL generated types from this directory.
      files: ['./graphql/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...restrictedSyntax.filter(
            (it) => it.selector != gqlTypeUsageSelector,
          ),
        ],
      },
    },
    {
      files: ['test/**/*.ts', './**/*.{spec,test}.ts'],
      rules: {
        'better-mutation/no-mutation': ['error', { allowThis: true }],
        'no-console': 'off',
      },
    },
  ],
};
