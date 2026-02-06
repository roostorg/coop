// We allow the test files, and only the test files, to reference node types cuz
// we don't run these in the browser.
/// <reference types="node" />
import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { makeDateString } from '../index.js';

const stringsAndExpectedResults = {
  '': undefined,
  abc: undefined,
  '1': undefined,
  '2023-04-12T19:47:09.406Z': '2023-04-12T19:47:09.406Z',
  '2023.0.1.01': undefined,
  '2023.01.01': undefined,
  '2023-04-12T19:47:09.40604Z': '2023-04-12T19:47:09.406Z',
  '2023-04-12T19:47:09.4Z': '2023-04-12T19:47:09.400Z',
};

describe('makeDateString', () => {
  it('should properly handle inputs', () => {
    Object.entries(stringsAndExpectedResults).map(([key, value]) => {
      const result = makeDateString(key);
      assert.ok(
        result === value,
        `makeDateString('${key}') was expected to be ${value}, but instead was ${result}.`,
      );
    });
  });
});
