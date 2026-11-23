import fc from 'fast-check';
import { buildASTSchema } from 'graphql';

import { mergeSchemaModules } from './schema.js';

const fieldNames = fc.stringMatching(/^field_[a-zA-Z0-9_]{1,16}$/);
const scalarTypes = fc.constantFrom('String', 'Int', 'Boolean');

describe('mergeSchemaModules', () => {
  test('rejects duplicate root fields regardless of return type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Query', 'Mutation', 'Subscription'),
        fc.constantFrom('type', 'extend type'),
        fieldNames,
        scalarTypes,
        scalarTypes,
        (rootType, declaration, field, firstType, secondType) => {
          expect(() =>
            mergeSchemaModules([
              `type ${rootType} { ${field}: ${firstType} }`,
              `${declaration} ${rootType} { unrelated: ID, ${field}: ${secondType} }`,
            ]),
          ).toThrow(`Duplicate root field ${rootType}.${field}`);
        },
      ),
      {
        examples: [
          ['Query', 'extend type', 'field_status', 'String', 'String'],
          ['Query', 'extend type', 'field_status', 'String', 'Int'],
          ['Mutation', 'type', 'field_status', 'Int', 'Int'],
          ['Mutation', 'type', 'field_status', 'Int', 'Boolean'],
          ['Subscription', 'extend type', 'field_status', 'Boolean', 'Boolean'],
          ['Subscription', 'extend type', 'field_status', 'Boolean', 'String'],
        ],
      },
    );
  });

  test('allows the same field name on different root types', () => {
    fc.assert(
      fc.property(fieldNames, (field) => {
        const schema = buildASTSchema(
          mergeSchemaModules([
            `type Query { ${field}: String }`,
            `type Mutation { ${field}: Int }`,
          ]),
        );

        expect(schema.getQueryType()?.getFields()[field].type.toString()).toBe(
          'String',
        );
        expect(
          schema.getMutationType()?.getFields()[field].type.toString(),
        ).toBe('Int');
      }),
    );
  });
});
