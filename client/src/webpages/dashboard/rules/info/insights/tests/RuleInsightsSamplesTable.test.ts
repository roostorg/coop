import { flattenRuleExecutionSampleForCSV } from '../RuleInsightsSamplesTable';

describe('RuleInsightsSamplesTable tests', () => {
  describe('CSV tests', () => {
    it('One level', () => {
      const content = { a: true, b: false, c: 1 };
      expect(flattenRuleExecutionSampleForCSV(null, content)).toMatchObject(
        content,
      );
    });
    it('Two levels, simple', () => {
      const content = { a: true, b: false, c: { c1: 1 } };
      expect(flattenRuleExecutionSampleForCSV(null, content)).toMatchObject({
        a: true,
        b: false,
        'c:c1': 1,
      });
    });
    it('Two levels, complex', () => {
      const content = { a: true, b: { b1: 1, b2: 2 }, c: { c1: 1 } };
      expect(flattenRuleExecutionSampleForCSV(null, content)).toMatchObject({
        a: true,
        'b:b1': 1,
        'b:b2': 2,
        'c:c1': 1,
      });
    });
    it('Three levels', () => {
      const content = {
        a: true,
        b: {
          b1: 1,
          b2: 2,
        },
        c: {
          c1: 1,
          c2: {
            c21: 'x',
            c22: 'y',
            c23: 'z',
          },
          c3: {
            c31: 'abc',
          },
        },
      };
      expect(flattenRuleExecutionSampleForCSV(null, content)).toMatchObject({
        a: true,
        'b:b1': 1,
        'b:b2': 2,
        'c:c1': 1,
        'c:c2:c21': 'x',
        'c:c2:c22': 'y',
        'c:c2:c23': 'z',
        'c:c3:c31': 'abc',
      });
    });
    it('Multiple levels, one branch', () => {
      const content = {
        a: {
          b: {
            c: {
              d: {
                e: 1,
              },
            },
          },
        },
      };
      expect(flattenRuleExecutionSampleForCSV(null, content)).toMatchObject({
        'a:b:c:d:e': 1,
      });
    });
  });
});
