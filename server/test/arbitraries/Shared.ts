import { CoopInput } from '../../services/moderationConfigService/index.js';
import { enumToArbitrary } from '../../utils/enum.js';

// Must be here to avoid a circular dependency between ContentType and Condition
// arbitraries.
export const CoopInputArbitrary = enumToArbitrary(CoopInput);
