import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAIModerationUtils.js';

/**
 * OpenAI image-moderation signal scoring whether an image promotes,
 * glorifies, or celebrates violence. Routes through omni-moderation-latest's
 * multimodal endpoint and returns the `violence` category score (0..1).
 */
const OpenAiViolenceImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_VIOLENCE_IMAGE_MODEL,
  displayName: 'OpenAI Violence Image score',
  description: `OpenAI's model that detects violence, which is defined as content that promotes or glorifies violence or celebrates the suffering or humiliation of others. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image depicts violence. For example, if the model produces a score of 0.76, that means the model is 76% confident that the image is violent.`,
  modelName: 'violence',
});

export default OpenAiViolenceImageSignal;
