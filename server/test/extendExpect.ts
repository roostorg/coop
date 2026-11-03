import { JSONPath } from 'jsonpath-plus';
import lodash from 'lodash';
import { Snapshots } from 'vitest';

const { toMatchSnapshot } = Snapshots;
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

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extends Vitest's matcher types
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
  > extends CustomMatchers<R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extends Vitest's matcher types
  interface AsymmetricMatchersContaining extends CustomMatchers {}
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
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, functional/immutable-data -- derived snapshot matchers
        delete generatedPropertyMatchers[key];
        JSONPath({ path: k, json: received, resultType: 'path' }).forEach(
          (pathStr: string) => {
            const path = JSONPath.toPathArray(pathStr).slice(1);
            set(generatedPropertyMatchers, path, propertyMatchers[key]);
          },
        );
      }
    });

    return toMatchSnapshot.call(
      this,
      received,
      generatedPropertyMatchers,
      hint,
    );
  },
});
