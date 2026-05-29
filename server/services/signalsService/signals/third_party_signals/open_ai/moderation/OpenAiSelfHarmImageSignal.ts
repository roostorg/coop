import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAIModerationUtils.js';

/**
 * OpenAI image-moderation signal scoring whether an image promotes,
 * encourages, or depicts acts of self-harm (suicide, cutting, eating
 * disorders, etc.). Routes through omni-moderation-latest's multimodal
 * endpoint and returns the `self-harm` category score (0..1).
 */
const OpenAiSelfHarmImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_SELF_HARM_IMAGE_MODEL,
  displayName: 'OpenAI Self-Harm Image score',
  description: `OpenAI's model that detects self-harm, which is defined as content that promotes, encourages, or depicts acts of self-harm, such as suicide, cutting, and eating disorders. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image depicts self-harm.`,
  modelName: 'self-harm',
});

export default OpenAiSelfHarmImageSignal;
