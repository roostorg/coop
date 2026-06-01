import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAIModerationUtils.js';

/**
 * OpenAI image-moderation signal scoring whether an image depicts death,
 * violence, or serious physical injury in extreme graphic detail. Routes
 * through omni-moderation-latest's multimodal endpoint and returns the
 * `violence/graphic` category score (0..1).
 */
const OpenAiGraphicViolenceImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_GRAPHIC_VIOLENCE_IMAGE_MODEL,
  displayName: 'OpenAI Graphic Violence Image score',
  description: `OpenAI's model that detects graphic violence, which is defined as content that depicts death, violence, or serious physical injury in extreme graphic detail. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image depicts graphic violence.`,
  modelName: 'violence/graphic',
});

export default OpenAiGraphicViolenceImageSignal;
