import { type HashBank as HashBankType } from '../services/hmaService/index.js';

// Re-export the HashBank type for GraphQL generated types
export type HashBank = HashBankType;

// This file exists to provide the HashBank type import that GraphQL codegen expects
// The actual HashBank functionality is implemented in the HMA service
export default HashBank;
