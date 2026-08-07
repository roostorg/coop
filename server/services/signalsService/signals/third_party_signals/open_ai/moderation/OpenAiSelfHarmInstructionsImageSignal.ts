import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAiModerationSignalFactory.js';

/**
 * OpenAI image-moderation signal scoring whether an image encourages or
 * provides instructions for self-harm. Routes through omni-moderation-latest's
 * multimodal endpoint and returns the `self-harm/instructions` category score
 * (0..1).
 */
const OpenAiSelfHarmInstructionsImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_SELF_HARM_INSTRUCTIONS_IMAGE_MODEL,
  displayName: 'OpenAI Self-Harm Instructions Image score',
  description: `OpenAI's model that detects content that encourages performing acts of self-harm, such as suicide, cutting, and eating disorders, or that gives instructions or advice on how to commit such acts. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image contains self-harm instructions.`,
  modelName: 'self-harm/instructions',
});

export default OpenAiSelfHarmInstructionsImageSignal;
