import { SignalType } from '../../../../types/SignalType.js';
import { makeOpenAiCsamClassifierImageSignal } from './openAiCsamClassifierSignalFactory.js';

/**
 * OpenAI Novel CSAM Classifier signal scoring the overall likelihood that an
 * image is child sexual abuse material, across all categories. Returns the
 * `likely-csam` category score (0..1); the gen-ai signal refines it.
 */
const OpenAiCsamOverallImageSignal = makeOpenAiCsamClassifierImageSignal({
  type: SignalType.OPEN_AI_CSAM_OVERALL_IMAGE_MODEL,
  displayName: 'OpenAI CSAM Classifier Overall Image score',
  description: `OpenAI's Novel CSAM Classifier overall score for whether an image is child sexual abuse material, aggregating across categories. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image is CSAM. Access is granted by OpenAI through its intake process.`,
  category: 'likely-csam',
});

export default OpenAiCsamOverallImageSignal;
