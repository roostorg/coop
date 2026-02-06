import { UserInputError } from 'apollo-server-express';
import { Kind, type GraphQLScalarType } from 'graphql';
import jwt from 'jsonwebtoken';

const parseOpaqueScalarValue =
  <T>(jwtSigningKey: string) =>
  (inputValue: unknown) => {
    if (typeof inputValue !== 'string') {
      throw new UserInputError('OpaqueScalar values must be strings.');
    }

    return jwt.verify(inputValue, jwtSigningKey) as T;
  };

/**
 * This mixin generates the necessary serialization/deserialization
 * configuration to encode an arbitrary value as a string-encoded JWT. This is
 * useful for encoding values that we need to send to the client for use in
 * future requests, (i.e. session tokens, workflows).
 *
 * It allows us to make the following assumptions:
 * * the client cannot modify the values we send them, and
 * * the client cannot construct their own instances of this object.
 *
 * With these assumptions, we can assume we're only getting back values that
 * we ourselves have generated and can thus skip a lot of parsing/validation
 * logic that would normally be needed to ensure JSON coming from the client
 * is the right shape.
 *
 * N.B. while we can be reasonably sure that the client will not be able to
 * access the values contained in the JWT, we should not treat this as an
 * encryption scheme. We should never store/send sensitive data using this
 * approach.
 */
export default <T extends object>(
  jwtSigningKey: string,
  // N.B. We set an expiration date for the token to be very long here to
  // accommodate a wide variety of use cases. In general this should be set to
  // the shortest acceptable time frame.
  jwtExpiresIn: string = '1y',
): Pick<
  GraphQLScalarType<T, string>,
  'serialize' | 'parseValue' | 'parseLiteral'
> => ({
  serialize(value) {
    return jwt.sign(value as T, jwtSigningKey, {
      expiresIn: jwtExpiresIn,
    });
  },
  parseValue: parseOpaqueScalarValue<T>(jwtSigningKey),
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new UserInputError('OpaqueScalar values must be strings.');
    }
    return parseOpaqueScalarValue<T>(jwtSigningKey)(ast.value);
  },
});
