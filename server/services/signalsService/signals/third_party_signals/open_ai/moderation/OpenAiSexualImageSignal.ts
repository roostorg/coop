import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAIModerationUtils.js';

/**
 * OpenAI image-moderation signal scoring whether an image is meant to arouse
 * sexual excitement or depicts sexual activity (excluding sex education and
 * wellness content). Routes through omni-moderation-latest's multimodal
 * endpoint and returns the `sexual` category score (0..1).
 */
const OpenAiSexualImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_SEXUAL_IMAGE_MODEL,
  displayName: 'OpenAI Sexual Image score',
  description: `OpenAI's model that detects sexual content, which is defined as content meant to arouse sexual excitement, such as the description of sexual activity, or that promotes sexual services (excluding sex education and wellness). Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image is sexual.`,
  modelName: 'sexual',
});

export default OpenAiSexualImageSignal;
