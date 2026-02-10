import { Readable } from 'node:stream';
import { ScalarTypes } from '@roostorg/types';
import streamToBlob from 'stream-to-blob';
import { FormData } from 'undici';

import { jsonStringify } from '../../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../../utils/errors.js';
import { Language } from '../../../../../../utils/language.js';
import { __throw } from '../../../../../../utils/misc.js';
import { type Bind1 } from '../../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../../types/Integration.js';
import { SignalPricingStructure } from '../../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../../SignalBase.js';

export type FetchOpenAiTranscription = Bind1<
  typeof getOpenAiTranscription,
  FetchHTTP
>;

type OpenAiWhisperResponse =
  | { text: string }
  | {
      error: {
        message?: string;
        type?: string;
        param?: string | null;
        code?: string | null;
      };
    };

export default class OpenAiWhisperTranscriptionSignal extends SignalBase<
  ScalarTypes['AUDIO'] | ScalarTypes['VIDEO'],
  { scalarType: ScalarTypes['STRING'] },
  unknown,
  'OPEN_AI_WHISPER_TRANSCRIPTION'
> {
  constructor(
    protected readonly getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
    protected readonly getOpenAiTranscription: FetchOpenAiTranscription,
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.OPEN_AI_WHISPER_TRANSCRIPTION };
  }

  override get displayName() {
    return 'OpenAI Transcription';
  }

  override get description() {
    return `OpenAI's Whisper audio transcription model that transcribes audio from an audio or video clip into text.`;
  }

  override get docsUrl() {
    return 'https://platform.openai.com/docs/guides/speech-to-text';
  }

  override get integration() {
    return Integration.OPEN_AI;
  }

  override get pricingStructure() {
    return SignalPricingStructure.SUBSCRIPTION;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get supportedLanguages() {
    return [
      Language.AFRIKAANS,
      Language.ARABIC,
      Language.ARMENIAN,
      Language.BELARUSIAN,
      Language.BOSNIAN,
      Language.BULGARIAN,
      Language.CATALAN,
      Language.CHINESE,
      Language.CROATIAN,
      Language.CZECH,
      Language.DANISH,
      Language.DUTCH,
      Language.ENGLISH,
      Language.ESTONIAN,
      Language.FINNISH,
      Language.FRENCH,
      Language.GALICIAN,
      Language.GERMAN,
      Language.GREEK,
      Language.HEBREW,
      Language.HINDI,
      Language.HUNGARIAN,
      Language.ICELANDIC,
      Language.INDONESIAN,
      Language.ITALIAN,
      Language.JAPANESE,
      Language.KANNADA,
      Language.KAZAKH,
      Language.KOREAN,
      Language.LATVIAN,
      Language.LITHUANIAN,
      Language.MACEDONIAN,
      Language.MALAY,
      Language.MARATHI,
      Language.MAORI,
      Language.NEPALI,
      Language.NORWEGIAN,
      Language.PERSIAN,
      Language.POLISH,
      Language.PORTUGUESE,
      Language.ROMANIAN,
      Language.RUSSIAN,
      Language.SERBIAN,
      Language.SLOVAK,
      Language.SLOVENE,
      Language.SPANISH,
      Language.SWAHILI,
      Language.SWEDISH,
      Language.TAGALOG,
      Language.TAMIL,
      Language.THAI,
      Language.TURKISH,
      Language.UKRAINIAN,
      Language.URDU,
      Language.VIETNAMESE,
      Language.WELSH,
    ];
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get needsMatchingValues() {
    return false;
  }

  override async getDisabledInfo(orgId: string) {
    const credential = await this.getOpenAiCredentials(orgId);
    return !credential?.apiKey
      ? {
          disabled: true as const,
          disabledMessage: `You need to input your OpenAI API key to use OpenAI's signals`,
        }
      : { disabled: false as const };
  }

  override get eligibleInputs() {
    return [ScalarTypes.AUDIO, ScalarTypes.VIDEO];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.STRING };
  }

  /**
   * Placeholder estimate
   */
  override getCost() {
    return 20;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  async run(
    input: SignalInput<
      ScalarTypes['AUDIO'] | ScalarTypes['VIDEO'],
      false,
      false,
      unknown,
      'OPEN_AI_WHISPER_TRANSCRIPTION'
    >,
  ) {
    const { value } = input;
    const credential = await this.getOpenAiCredentials(input.orgId);

    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (!credential || !credential.apiKey) {
      throw new Error('Missing API credentials');
    }

    const response = await this.getOpenAiTranscription({
      url: value.value.url,
      apiKey: credential.apiKey,
    });

    if (response.length === 0) {
      throw new Error('Empty OpenAI results');
    }

    return {
      score: response,
      outputType: { scalarType: ScalarTypes.STRING },
    };
  }
}

export async function getOpenAiTranscription(
  fetchHTTP: FetchHTTP,
  req: { url: string; apiKey: string },
): Promise<string> {
  const { url, apiKey } = req;
  const formData = await getWhisperAPIFormDataForUrl(fetchHTTP, url);
  const response = await fetchHTTP({
    url: 'https://api.openai.com/v1/audio/transcriptions',
    method: 'post',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    handleResponseBody: 'as-json',
    // This request is made as part of running Rules on an incoming item
    // submission, so, if it takes a long time, the server's memory usage
    // grows a lot and things grind to a halt (because the memory for the
    // item submission and the rule engine state can't be reclaimed). Having
    // a timeout prevents that, at the expense of occasional, very
    // acceptable, signal failures. This'll be solved more rigorously once
    // the API server's item processing speed controls the rate at which it
    // dequeues item submissions to process.
    timeoutMs: 5_000,
  });

  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw makeSignalPermanentError('Unauthorized: Invalid OpenAI API key', {
          shouldErrorSpan: true,
        });
      case 400:
        throw makeSignalPermanentError(
          `OpenAI reported client error: ${jsonStringify(
            (response.body as { error: unknown } | undefined)?.error,
          )}`,
          { shouldErrorSpan: true },
        );
      case 429:
        throw new Error('OpenAI Whisper: Too many requests');
      default:
        throw new Error('Unknown API error');
    }
  }

  const responseJson = response.body as OpenAiWhisperResponse;
  return 'text' in responseJson
    ? responseJson.text
    : __throw(new Error('Unexpected success response format'));
}

async function getWhisperAPIFormDataForUrl(fetchHTTP: FetchHTTP, url: string) {
  try {
    const response = await fetchHTTP({
      url,
      method: 'get',
      handleResponseBody: 'as-readable-stream',
      maxResponseSize: '25mb',
      iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
    });

    if (!response.ok || !response.body) {
      throw Error(
        `Request for audio file errored or returned no data, with status code ${response.status}`,
      );
    }

    // NB: we intentionally use the form-data package here instead of the built-in
    // FormData global because the latter doesn't support streaming.
    const formData = new FormData();
    const returnedContentType = response.headers.get('content-type');

    if (!returnedContentType) {
      throw makeSignalPermanentError(
        "No content type returned from user's audio file",
        { shouldErrorSpan: true },
      );
    }

    const inferredFileExtension =
      openAIfileExtensionFromContentType(returnedContentType);

    if (!inferredFileExtension) {
      throw makeSignalPermanentError(
        "Could not infer a valid file extension from the user's audio file",
        { shouldErrorSpan: true },
      );
    }

    formData.append(
      'file',
      await streamToBlob(Readable.fromWeb(response.body), returnedContentType),
      // See comment above openAIfileExtensionFromContentType
      'file.' + inferredFileExtension,
    );
    formData.append('model', 'whisper-1');

    return formData;
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'ResponseExceededMaxSizeError') {
        throw makeSignalPermanentError('Input file too large', {
          shouldErrorSpan: true,
        });
      }
    }

    throw e;
  }
}

/**
 * OpenAI determines content type of a file sent to whisper by parsing the
 * file's name and using the extension (rather than using the Content-Type header,
 * so we have to synthesize a filename based on the file types that Whisper supports:
 *
 * @param rawType
 * @returns
 */
function openAIfileExtensionFromContentType(rawType: string) {
  const whisperFileExtensions = [
    'mp3',
    'mp4',
    'mpeg',
    'mpga',
    'm4a',
    'wav',
    'webm',
  ];

  const mimeTypes = {
    'audio/mpeg': 'mp3',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpeg',
    'audio/mp4a-latm': 'm4a',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/wav': 'wav',
    'audio/x-pn-wav': 'wav',
    'audio/webm': 'webm',
  };

  const extensionFromMimeType = (
    mimeTypes as { [k: string]: string | undefined }
  )[rawType];

  return (
    extensionFromMimeType ??
    whisperFileExtensions.find((it) => rawType.includes(it))
  );
}
