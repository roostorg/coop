// eslint-disable-next-line import/no-extraneous-dependencies
import jestSnapshot from 'jest-snapshot';
// eslint-disable-next-line import/no-extraneous-dependencies
import jsonPath from 'jsonpath';
import lodash from 'lodash';

const { toMatchSnapshot } = jestSnapshot;
const { set } = lodash;

interface CustomMatchers<R = unknown> {
  /**
   * This assertion works like `toMatchSnapshot`, except that it makes it
   * easier to define many asymmetric property matchers at once, to better
   * support cases where many keys in the snapshot have dynamic values.
   *
   * For example, the data being snapshotted might be a list of newly-created
   * objects, each of which has a dynamically-generated id. In that case, you
   * could use this assertion to easily require that every id is a string:
   *
   * `toMatchDynamicSnapshot({ '$[*].id': expect.any(String) })`.
   *
   * In the above, the `$[*].id` key is a jsonpath expression that matches the
   * id property of every object in the root list.
   */
  toMatchDynamicSnapshot(propertyMatchers: object, hint?: string): R;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // Normally, an empty interface in TS is pointless but, in this case, we're
    // actually taking advantage of declaration merging (on Expect, Matchers,
    // and InverseAsymmetricMatchers) to make those interfaces, which are defined
    // elsewhere extend our CustomMatchers interface.
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Expect extends CustomMatchers {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Matchers<R> extends CustomMatchers<R> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}

expect.extend({
  toMatchDynamicSnapshot(received, propertyMatchers: object, hint?: string) {
    // Treat property matcher keys as jsonpath queries
    // if they start with a $ and contain a dot.
    const isJsonPath = (it: string) => it[0] === '$' && it.includes('.');
    const generatedPropertyMatchers = { ...propertyMatchers };

    Object.keys(propertyMatchers).forEach((k) => {
      const key = k as keyof typeof generatedPropertyMatchers &
        keyof typeof propertyMatchers;

      if (isJsonPath(k)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete generatedPropertyMatchers[key];
        jsonPath.paths(received, k).forEach((path) => {
          set(generatedPropertyMatchers, path.slice(1), propertyMatchers[key]);
        });
      }
    });

    return (toMatchSnapshot as any).call(
      this,
      received,
      generatedPropertyMatchers,
      hint,
    );
  },
});
