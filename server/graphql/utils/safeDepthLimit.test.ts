import {
  buildSchema,
  parse,
  validate,
  type DocumentNode,
  type GraphQLSchema,
} from 'graphql';

import { safeDepthLimit } from './safeDepthLimit.js';

const schema: GraphQLSchema = buildSchema(`
  type Query {
    me: User
  }
  type User {
    id: ID!
    name: String
    friends: [User!]!
  }
`);

function parseQuery(source: string): DocumentNode {
  return parse(source);
}

describe('safeDepthLimit', () => {
  test('rejects queries deeper than the configured maximum', () => {
    const doc = parseQuery(`
      query {
        me {
          friends {
            friends {
              friends {
                id
              }
            }
          }
        }
      }
    `);
    const errors = validate(schema, doc, [safeDepthLimit(2)]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/exceeds maximum operation depth/);
  });

  test('allows queries within the configured maximum', () => {
    const doc = parseQuery(`
      query {
        me {
          id
        }
      }
    `);
    const errors = validate(schema, doc, [safeDepthLimit(5)]);
    expect(errors).toEqual([]);
  });

  test('does not throw when a query references an undefined fragment', () => {
    const doc = parseQuery(`
      query {
        me {
          ...MissingFields
        }
      }
    `);
    expect(() => validate(schema, doc, [safeDepthLimit(10)])).not.toThrow();
  });

  test('logs the offending operation name when it falls back', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const doc = parseQuery(`
        query MyOp {
          me { ...MissingFields }
        }
      `);
      validate(schema, doc, [safeDepthLimit(10)]);
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('safeDepthLimit');
      expect(message).toContain('MyOp');
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
