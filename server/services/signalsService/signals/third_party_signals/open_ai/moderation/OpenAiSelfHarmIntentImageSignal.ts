import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiImageModerationSignal } from './openAiModerationSignalFactory.js';

/**
 * OpenAI image-moderation signal scoring whether an image expresses the
 * speaker's intent to engage in acts of self-harm. Routes through
 * omni-moderation-latest's multimodal endpoint and returns the
 * `self-harm/intent` category score (0..1).
 */
const OpenAiSelfHarmIntentImageSignal = makeOpenAiImageModerationSignal({
  type: SignalType.OPEN_AI_SELF_HARM_INTENT_IMAGE_MODEL,
  displayName: 'OpenAI Self-Harm Intent Image score',
  description: `OpenAI's model that detects self-harm intent, which is defined as content where the speaker expresses that they are engaging or intend to engage in acts of self-harm, such as suicide, cutting, and eating disorders. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image expresses self-harm intent.`,
  modelName: 'self-harm/intent',
});

export default OpenAiSelfHarmIntentImageSignal;
