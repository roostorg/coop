import { SignalSubcategory } from '@roostorg/types';
import transform from 'lodash/transform';

import { GQLSignalSubcategory } from '../graphql/generated';
import { safePick } from './misc';

/**
 * GraphQL is unable to handle recursively defined types, so we had to flatten
 * the subcategory list on the server before sending to the client. However,
 * it's much easier to work with these in tree form, so this is a function to
 * help reconstruct the tree, or more specifically, map from
 * GQLSignalSubcategory to an array of SignalSubcategory.
 *
 * NB: even though the type returned is a list, it should be very rare, if ever,
 * that we would return a list with more than one item, since each item in the
 * list is the root of its own tree, and we generally only have a single tree of
 * subcategories for a given signal.
 */
export function rebuildSubcategoryTreeFromGraphQLResponse(
  subcategories: readonly Omit<GQLSignalSubcategory, '__typename'>[],
): SignalSubcategory[] {
  function rebuildTree(
    subcategories: readonly Omit<GQLSignalSubcategory, '__typename'>[],
  ): SignalSubcategory[] {
    return subcategories.map((subcategory) => ({
      id: subcategory.id,
      label: subcategory.label,
      description: subcategory.description ?? undefined,
      children: rebuildTree(
        subcategories.filter((sub) => subcategory.childrenIds.includes(sub.id)),
      ),
    }));
  }

  return rebuildTree(subcategories).filter(
    (subcategory) => subcategory.children?.length,
  );
}

export function createSubcategoryIdToLabelMapping(
  signals: readonly {
    integration?: string | null;
    eligibleSubcategories: readonly { id: string; label: string }[];
  }[],
) {
  return transform(
    signals
      .flatMap((signal) =>
        signal.eligibleSubcategories.map((subcategory) => ({
          integration: signal.integration,
          ...safePick(subcategory, ['id', 'label']),
        })),
      )
      .filter((subcategory) => subcategory.integration != null),
    (result, current) => {
      result[`${current.integration}:${current.id}`] = current.label;
    },
    {} as { [key: string]: string },
  );
}
