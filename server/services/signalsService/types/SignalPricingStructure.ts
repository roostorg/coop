import { makeEnumLike } from '@roostorg/types';

export const SignalPricingStructure = makeEnumLike(['FREE', 'SUBSCRIPTION']);
export type SignalPricingStructure = keyof typeof SignalPricingStructure;
