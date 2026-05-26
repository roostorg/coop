import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiTextModerationSignal } from './openAiModerationSignalFactory.js';

/**
 * OpenAI text-moderation signal scoring whether text expresses the speaker's
 * intent to engage in acts of self-harm (suicide, cutting, eating disorders,
 * etc.). Routes through omni-moderation-latest and returns the
 * `self-harm/intent` category score (0..1).
 */
const OpenAiSelfHarmIntentTextSignal = makeOpenAiTextModerationSignal({
  type: SignalType.OPEN_AI_SELF_HARM_INTENT_TEXT_MODEL,
  displayName: 'OpenAI Self-Harm Intent Text score',
  description: `OpenAI's model that detects self-harm intent, which is defined as content where the speaker expresses that they are engaging or intend to engage in acts of self-harm, such as suicide, cutting, and eating disorders.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the content expresses self-harm intent.`,
  modelName: 'self-harm/intent',
});

export default OpenAiSelfHarmIntentTextSignal;
