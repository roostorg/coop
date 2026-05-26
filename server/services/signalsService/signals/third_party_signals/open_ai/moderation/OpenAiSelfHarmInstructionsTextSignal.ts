import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiTextModerationSignal } from './openAiModerationSignalFactory.js';

/**
 * OpenAI text-moderation signal scoring whether text encourages or provides
 * instructions for self-harm (suicide, cutting, eating disorders, etc.).
 * Routes through omni-moderation-latest and returns the
 * `self-harm/instructions` category score (0..1).
 */
const OpenAiSelfHarmInstructionsTextSignal = makeOpenAiTextModerationSignal({
  type: SignalType.OPEN_AI_SELF_HARM_INSTRUCTIONS_TEXT_MODEL,
  displayName: 'OpenAI Self-Harm Instructions Text score',
  description: `OpenAI's model that detects content that encourages performing acts of self-harm, such as suicide, cutting, and eating disorders, or that gives instructions or advice on how to commit such acts.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the content contains self-harm instructions.`,
  modelName: 'self-harm/instructions',
});

export default OpenAiSelfHarmInstructionsTextSignal;
