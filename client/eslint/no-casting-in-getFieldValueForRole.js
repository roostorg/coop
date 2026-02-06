module.exports = {
  create(context) {
    function inspectNodeForCasts(node) {
      // Check if node is a cast expression
      if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') {
        context.report({
          node,
          message: `Do not cast arguments when calling getFieldValueForRole.
          Instead, set the type parameters (i.e. the generics) explicitly. 
          This will ensure that we maintain type safety and avoid runtime 
          errors from bad casts. The motivation for this is based on the limits of 
          Typescript's inference capabilities. Basically, if we've already narrowed 
          the type of the item to a single case of GQLItem (i.e. content, thread, or user), 
          then the function is able to appropriately typecheck the schemaFieldRoles. However, if the 
          item has not been narrowed yet, Typescript isn't able to infer what type the 
          schemaFieldRoles should actually be, so the compiler complains. The easy way 
          would be to cast it to one of the concrete item types, but this is unsafe 
          and could cause runtime errors if the cast is incorrect. Instead, setting the 
          type parameters explicitly will satisfy the compiler while maintaining type safety.
          An example of setting the type parameters would look something like this: 
          
          getFieldValueForRole<
            GQLSchemaFieldRoles,
            keyof GQLSchemaFieldRoles
          >(reportedItem, 'displayName')`
        });
      }

      // If node is an object literal, recursively check its properties
      if (node.type === 'ObjectExpression') {
        node.properties.forEach((property) => {
          // Recursively check each property value
          inspectNodeForCasts(property.value);
        });
      }

      // Handle array access and member expressions
      if (node.type === 'MemberExpression' || node.type === 'ArrayExpression') {
        inspectNodeForCasts(node.object);
        if (node.property) {
          inspectNodeForCasts(node.property);
        }
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.name === 'getFieldValueForRole') {
          node.arguments.forEach((arg) => {
            inspectNodeForCasts(arg); // Use the recursive function here
          });
        }
      },
    };
  },
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not cast arguments when calling getFieldValueForRole. Instead, set the generic types explicitly. This will ensure that we maintain type safety and avoid runtime errors from bad casts.',
    },
  },
};
