import { type Bind1 } from '../../../../../utils/typescript-types.js';
import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { jsonStringify } from '../../../../../utils/encoding.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';

/**
 * Prompt template used by the CoPE model (cope-a-9b) when self-hosted.
 * Matches the template from the official Zentropi sample notebook exactly.
 */
const COPE_PROMPT_TEMPLATE = `INSTRUCTIONS
============

Examine the given POLICY and determine if the given CONTENT meets the criteria for ANY of the LABELS. Answer "1" if yes, and "0" if no.

POLICY
======

{criteria}


CONTENT
=======

{content}


ANSWER
======

`;

export type OpenAICompatibleFormat = 'cope' | 'openai_chat';

export type OpenAICompatibleClassifierParams = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  criteria: string;
  content: string;
} & (
  | { format: 'cope' }
  | {
      format: 'openai_chat';
      systemPromptTemplate: string;
      userMessageTemplate: string;
    }
);

export type FetchOpenAICompatibleScore = Bind1<
  typeof getOpenAICompatibleScore,
  FetchHTTP
>;

/**
 * Converts a logprob (log probability) and the predicted label token to a
 * 0–1 score matching the Zentropi hosted API convention:
 *   label=1 → confidence (higher = more likely violating)
 *   label=0 → 1 - confidence (higher = more likely violating)
 */
export function scoreFromLogprob(
  label: '0' | '1',
  logprob: number,
): number {
  const confidence = Math.exp(logprob);
  return label === '1' ? confidence : 1 - confidence;
}

/**
 * Calls an OpenAI-compatible completions or chat/completions endpoint to
 * classify text against a policy, returning a 0–1 score.
 *
 * Reusable by any integration that self-hosts a classification model via
 * vLLM or another OpenAI-compatible inference server.
 */
export async function getOpenAICompatibleScore(
  fetchHTTP: FetchHTTP,
  params: OpenAICompatibleClassifierParams,
): Promise<{ score: number }> {
  const { baseUrl, model, apiKey, criteria, content, format } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  let response;

  if (format === 'cope') {
    const prompt = COPE_PROMPT_TEMPLATE.replace('{criteria}', criteria).replace(
      '{content}',
      content,
    );

    response = await fetchHTTP({
      url: `${baseUrl}/v1/completions`,
      method: 'post',
      headers,
      body: jsonStringify({ model, prompt, max_tokens: 1, logprobs: 1 }),
      handleResponseBody: 'as-json',
      timeoutMs: 10_000,
    });

    if (!response.ok) {
      throwResponseError(response.status, baseUrl);
    }

    const body = response.body as {
      choices: { text: string; logprobs: { token_logprobs: number[] } }[];
    };
    const choice = body.choices[0];
    const label = choice.text.trim() as '0' | '1';
    const logprob = choice.logprobs.token_logprobs[0];
    return { score: scoreFromLogprob(label, logprob) };
  } else {
    // openai_chat format
    const { systemPromptTemplate, userMessageTemplate } =
      params;

    const systemContent = systemPromptTemplate.replace('{criteria}', criteria);
    const userContent = userMessageTemplate.replace('{content}', content);

    response = await fetchHTTP({
      url: `${baseUrl}/v1/chat/completions`,
      method: 'post',
      headers,
      body: jsonStringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1,
        logprobs: true,
        top_logprobs: 2,
      }),
      handleResponseBody: 'as-json',
      timeoutMs: 10_000,
    });

    if (!response.ok) {
      throwResponseError(response.status, baseUrl);
    }

    const body = response.body as {
      choices: {
        message: { content: string };
        logprobs: { content: { token: string; logprob: number }[] };
      }[];
    };
    const choice = body.choices[0];
    const label = choice.message.content.trim() as '0' | '1';
    const logprob = choice.logprobs.content[0]?.logprob ?? 0;
    return { score: scoreFromLogprob(label, logprob) };
  }
}

function throwResponseError(status: number, baseUrl: string): never {
  if (status === 401 || status === 403) {
    throw makeSignalPermanentError(
      `Self-hosted model API error: ${status} (invalid API key for ${baseUrl})`,
      { shouldErrorSpan: true },
    );
  }
  if (status === 404) {
    throw makeSignalPermanentError(
      `Self-hosted model API error: 404 (check base URL and model name — ${baseUrl})`,
      { shouldErrorSpan: true },
    );
  }
  throw new Error(`Self-hosted model API error: ${status}`);
}
