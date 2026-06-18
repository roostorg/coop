const { Linter } = require('eslint');
const rule = require('../no-casting-in-getFieldValueForRole');

const linter = new Linter();

const runLint = (code) => {
  const messages = linter.verify(code, {
    plugins: {
      custom: {
        rules: {
          'no-casting-in-getFieldValueForRole': rule,
        },
      },
    },
    rules: {
      'custom/no-casting-in-getFieldValueForRole': 'error',
    },
    languageOptions: { ecmaVersion: 2015, sourceType: 'module' },
  });
  return messages;
};

describe('no-casting-in-getFieldValueForRole rule', () => {
  it('should pass on valid cases', () => {
    const validCodes = [`getFieldValueForRole(reportedItem, 'displayName')`];

    validCodes.forEach((code) => {
      expect(runLint(code)).toHaveLength(0);
    });
  });

  it('should fail on invalid cases', () => {
    const invalidCases = [
      {
        code: `getFieldValueForRole(reportedItem as GQLContentItem, 'displayName')`,
        errors: 1,
      },
      {
        code: `getFieldValueForRole({data: reportedItem.data, type: reportedItem.type as GQLContentItemType}, 'displayName')`,
        errors: 1,
      },
      {
        code: `getFieldValueForRole({data: reportedItem.data, type: itemTypes[0] as GQLContentItemType}, 'displayName')`,
        errors: 1,
      },
    ];

    invalidCases.forEach(({ code, errors }) => {
      const result = runLint(code);
      expect(result).toHaveLength(errors);
    });
  });
});
