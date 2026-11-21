// Shapes of jsonb columns, attached to the model with `.$type<...>()`.
// Kept here, rather than in the services that own them, so the model has no
// imports from service code.

export type SigningKeyData = {
  publicKeyWithAlgorithm: { key: JsonWebKey; algorithm: KeyAlgorithm };
  privateKeyWithAlgorithm: { key: JsonWebKey; algorithm: KeyAlgorithm };
};
