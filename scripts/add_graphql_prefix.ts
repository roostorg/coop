const { pascalCase } = require('change-case-all');

// Add 'GraphQL' prefix to all generated GraphQL types
function AddGraphQLPrefix(str) {
  const result = pascalCase(str);
  if (result.length === 0) {
    // pascalCase function has a bug that, if you pass _ to it,
    // it will return an empty string. In this case, just return
    // the original
    return str;
  }

  // Unsure why, but for some reason 'GraphQl' is being inserted
  // into the middle of some types. This is hacky but should work
  // to remove that when it happens.
  return `GQL${result.replace('Gql', '')}`;
}

module.exports = AddGraphQLPrefix;
