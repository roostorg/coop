import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiCsamClassifierImageSignal } from './openAiCsamClassifierSignalFactory.js';

/**
 * OpenAI Novel CSAM Classifier signal scoring whether an image is
 * AI-generated child sexual abuse material. Returns the
 * `likely-csam/gen-ai` category score (0..1).
 */
const OpenAiCsamGenAiImageSignal = makeOpenAiCsamClassifierImageSignal({
  type: SignalType.OPEN_AI_CSAM_GENAI_IMAGE_MODEL,
  displayName: 'OpenAI CSAM Classifier GenAI Image score',
  description: `OpenAI's Novel CSAM Classifier category that detects AI-generated child sexual abuse material. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image is AI-generated CSAM. Access is granted by OpenAI through its intake process.`,
  category: 'likely-csam/gen-ai',
});

export default OpenAiCsamGenAiImageSignal;
