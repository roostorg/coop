/* eslint-disable max-lines */
import { type JsonValue } from 'type-fest';
import { inject } from '../../iocContainer/utils.js';
import type { Dependencies } from '../../iocContainer/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import type { HashBank } from './dbTypes.js';
import { HashBankService } from './hashBankService.js';

// Export types for external use
export type { HashBank } from './dbTypes.js';
export { HashBankService } from './hashBankService.js';

export type ContentType = 'photo' | 'video';

export interface BankContentResponse {
  id: number;
  signals: Record<string, string>;
}

export interface BankMatch {
  bank_content_id: number;
  distance: string;
}

export interface BankMatches {
  [bankName: string]: BankMatch[];
}

export interface LookupResponse {
  [bankName: string]: BankMatch[] | undefined;
}

export interface ExchangeFieldDescriptor {
  name: string;
  type: string;
  required: boolean;
  default: JsonValue | null;
  help: string;
  choices: string[] | null;
}

export interface ExchangeSchemaSection {
  fields: ExchangeFieldDescriptor[];
}

export interface ExchangeApiSchema {
  config_schema: ExchangeSchemaSection;
  credentials_schema: ExchangeSchemaSection | null;
}

export interface ExchangeApiInfo {
  name: string;
  supports_auth: boolean;
  has_auth: boolean;
}

export interface ExchangeInfo {
  api: string;
  enabled: boolean;
  has_auth: boolean;
  error?: string | null;
  last_fetch_succeeded?: boolean | null;
  last_fetch_time?: string | null;
  up_to_date?: boolean | null;
  fetched_items?: number | null;
  is_fetching?: boolean | null;
}

const KNOWN_EXCHANGE_SCHEMAS: Partial<Record<string, ExchangeApiSchema>> = {
  fb_threatexchange: {
    config_schema: {
      fields: [
        {
          name: 'privacy_group',
          type: 'number',
          required: true,
          default: null,
          help: 'ThreatPrivacyGroup ID for this collaboration',
          choices: null,
        },
      ],
    },
    credentials_schema: {
      fields: [
        {
          name: 'api_token',
          type: 'string',
          required: true,
          default: null,
          help: 'Meta app access token. Create one at https://developers.facebook.com/tools/accesstoken/ for your ThreatExchange app.',
          choices: null,
        },
      ],
    },
  },
  ncmec: {
    config_schema: {
      fields: [
        {
          name: 'environment',
          type: 'enum',
          required: true,
          default: null,
          help: 'which database to connect to',
          choices: [
            'https://report.cybertip.org/hashsharing',
            'https://hashsharing.ncmec.org/npo',
            'https://hashsharing.ncmec.org/exploitative',
            'https://exttest.cybertip.org/hashsharing',
            'https://hashsharing-test.ncmec.org/npo',
            'https://hashsharing-test.ncmec.org/exploitative',
          ],
        },
        {
          name: 'only_esp_ids',
          type: 'set_of_number',
          required: false,
          default: null,
          help: 'Only take entries from these electronic service provider (ESP) ids',
          choices: null,
        },
      ],
    },
    credentials_schema: {
      fields: [
        {
          name: 'user',
          type: 'string',
          required: true,
          default: null,
          help: 'NCMEC hash sharing API username.',
          choices: null,
        },
        {
          name: 'password',
          type: 'string',
          required: true,
          default: null,
          help: 'NCMEC hash sharing API password.',
          choices: null,
        },
      ],
    },
  },
  stop_ncii: {
    config_schema: { fields: [] },
    credentials_schema: {
      fields: [
        {
          name: 'fetch_function_key',
          type: 'string',
          required: true,
          default: null,
          help: 'API key for the Fetch Hashes endpoint. Used when downloading hashes from StopNCII.',
          choices: null,
        },
        {
          name: 'subscription_key',
          type: 'string',
          required: true,
          default: null,
          help: 'Azure API Management subscription key. Sent as Ocp-Apim-Subscription-Key on all requests.',
          choices: null,
        },
        {
          name: 'base_url_override',
          type: 'string',
          required: false,
          default: null,
          help: 'Optional. Override the API base URL (e.g. for testing). Leave blank to use https://api.stopncii.org/v1',
          choices: null,
        },
      ],
    },
  },
};

export class HmaService {
  private readonly hmaServiceUrl: string;
  private readonly hashBankService: HashBankService;
  
  constructor(
    private readonly fetchHTTP: Dependencies['fetchHTTP'],
    kyselyPg: Dependencies['KyselyPg']
  ) {
    this.hmaServiceUrl = process.env.HMA_SERVICE_URL ?? 'http://localhost:9876/';
    this.hashBankService = new HashBankService(kyselyPg);
  }

  private getHmaName(orgId: string, name: string): string {
    // Convert to uppercase and replace spaces and special characters with underscores
    const normalizedName = name
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_') // Replace any non-alphanumeric chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single underscore
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    return `COOP_${orgId.toUpperCase()}_${normalizedName}`;
  }

  async createBank(
    orgId: string,
    name: string,
    description: string,
    enabled_ratio: number,
    exchange?: { apiName: string; apiJson: Record<string, unknown> }
  ): Promise<HashBank> {
    const hmaName = this.getHmaName(orgId, name);

    if (exchange) {
      // POST /c/exchanges creates both the exchange and the bank in HMA
      const requestBody = {
        bank: hmaName,
        api: exchange.apiName,
        api_json: exchange.apiJson,
      };

      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/exchanges`,
        method: 'post',
        body: jsonStringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
        handleResponseBody: 'discard',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create exchange in HMA: status=${response.status}`
        );
      }

      if (enabled_ratio !== 1.0) {
        await this.fetchHTTP({
          url: `${this.hmaServiceUrl}/c/bank/${hmaName}`,
          method: 'put',
          body: jsonStringify({ enabled_ratio }),
          headers: { 'Content-Type': 'application/json' },
          handleResponseBody: 'discard',
        });
      }
    } else {
      const requestBody = {
        name: hmaName,
        enabled_ratio: enabled_ratio.toString(),
      };

      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/banks`,
        method: 'post',
        body: jsonStringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
        handleResponseBody: 'as-json',
      });

      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          responseBody: response.body,
          requestBody,
          url: `${this.hmaServiceUrl}/c/banks`,
          headers: response.headers,
        };
        throw new Error(`Failed to create HMA bank: ${jsonStringify(errorDetails)}`);
      }
    }

    try {
      const bank = await this.hashBankService.create({
        name,
        hma_name: hmaName,
        description,
        enabled_ratio,
        org_id: orgId,
      });

      return bank;
    } catch (error) {
      try {
        await this.fetchHTTP({
          url: `${this.hmaServiceUrl}/c/bank/${hmaName}`,
          method: 'delete',
          handleResponseBody: 'discard',
        });
      } catch (cleanupError) {
        // eslint-disable-next-line no-console
        console.error('Failed to clean up HMA bank after local creation failed:', cleanupError);
      }
      throw error;
    }
  }

  async updateBank(orgId: string, id: string, updates: { name?: string; description?: string; enabled_ratio?: number }): Promise<HashBank> {
    // Get the existing bank
    const bank = await this.hashBankService.findById(parseInt(id), orgId);

    if (!bank) {
      throw new Error('Bank not found');
    }

    // If name is being updated, we need to update the HMA bank name
    if (updates.name && updates.name !== bank.name) {
      const newHmaName = this.getHmaName(orgId, updates.name);
      
      // Create new bank in HMA with new name
      const createRequestBody = {
        name: newHmaName,
        enabled_ratio: (updates.enabled_ratio ?? bank.enabled_ratio).toString()
      };

      const createResponse = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/banks`,
        method: "post",
        body: jsonStringify(createRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
        handleResponseBody: 'as-json',
      });

      if (!createResponse.ok) {
        const errorDetails = {
          status: createResponse.status,
          responseBody: createResponse.body,
          requestBody: createRequestBody,
          url: `${this.hmaServiceUrl}/c/banks`,
          headers: createResponse.headers
        };
        throw new Error(`Failed to create new HMA bank: ${jsonStringify(errorDetails)}`);
      }

      // Delete old HMA bank
      try {
        await this.fetchHTTP({
          url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
          method: "delete",
          handleResponseBody: 'discard',
        });
      } catch (deleteError) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete old HMA bank:', deleteError);
      }

      // Update local bank with new name and HMA name
      const updatedBank = await this.hashBankService.update(Number(bank.id), orgId, {
        name: updates.name,
        hma_name: newHmaName,
        description: updates.description,
        enabled_ratio: updates.enabled_ratio,
      });
      return updatedBank;
    } else if (updates.enabled_ratio !== undefined && updates.enabled_ratio !== bank.enabled_ratio) {
      // If only enabled_ratio is being updated, use PUT to update HMA service
      const updateRequestBody = {
        enabled_ratio: updates.enabled_ratio
      };

      const updateResponse = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
        method: "put",
        body: jsonStringify(updateRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
        handleResponseBody: 'as-json',
      });

      if (!updateResponse.ok) {
        const errorDetails = {
          status: updateResponse.status,
          responseBody: updateResponse.body,
          requestBody: updateRequestBody,
          url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
          headers: updateResponse.headers
        };
        throw new Error(`Failed to update HMA bank: ${jsonStringify(errorDetails)}`);
      }
    }

    // Update other fields if they weren't already updated above
    const fieldsToUpdate: { description?: string | null; enabled_ratio?: number } = {};
    if (updates.description !== undefined) {
      fieldsToUpdate.description = updates.description;
    }
    if (updates.enabled_ratio !== undefined) {
      fieldsToUpdate.enabled_ratio = updates.enabled_ratio;
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      const updatedBank = await this.hashBankService.update(Number(bank.id), orgId, fieldsToUpdate);
      return updatedBank;
    }

    return bank;
  }

  async deleteBank(orgId: string, id: string): Promise<void> {
    // Get the bank
    const bank = await this.hashBankService.findById(parseInt(id), orgId);

    if (!bank) {
      throw new Error('Bank not found');
    }

    // Delete from HMA service
    try {
      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
        method: "delete",
        handleResponseBody: 'discard',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete HMA bank: ${response.status}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete HMA bank:', error);
    }

    // Delete local copy
    await this.hashBankService.delete(Number(bank.id), orgId);
  }

  async getBank(orgId: string, name: string): Promise<HashBank | null> {
    // Get local bank
    const bank = await this.hashBankService.findByName(name, orgId);

    if (!bank) {
      return null;
    }

    // Verify bank exists in HMA service
    try {
      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
        method: "get",
        handleResponseBody: 'discard',
      });

      if (response.status === 404) {
        // Bank doesn't exist in HMA, delete local copy
        await this.hashBankService.delete(Number(bank.id), orgId);
        return null;
      }

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Failed to verify bank ${bank.hma_name} in HMA service: ${response.status}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Network error verifying bank ${bank.hma_name}:`, error);
    }

    return bank;
  }

  async getBankById(orgId: string, id: number): Promise<HashBank | null> {
    // Get local bank by ID
    const bank = await this.hashBankService.findById(id, orgId);

    if (!bank) {
      return null;
    }

    // Verify bank exists in HMA service
    try {
      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
        method: "get",
        handleResponseBody: 'discard',
      });

      if (response.status === 404) {
        // Bank doesn't exist in HMA, delete local copy
        await this.hashBankService.delete(Number(bank.id), orgId);
        return null;
      }

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Failed to verify bank ${bank.hma_name} in HMA service: ${response.status}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Network error verifying bank ${bank.hma_name}:`, error);
    }

    return bank;
  }

  async listBanks(orgId: string): Promise<HashBank[]> {
    try {
      // Get all local banks for org
      const banks = await this.hashBankService.findAllByOrgId(orgId);

      // Filter out banks that don't exist in HMA service
      const validBanks = await Promise.all(
        banks.map(async (bank) => {
          try {
            const response = await this.fetchHTTP({
              url: `${this.hmaServiceUrl}/c/bank/${bank.hma_name}`,
              method: "get",
              headers: {
                'Content-Type': 'application/json',
              },
              handleResponseBody: 'as-json',
            });

            if (response.status === 404) {
              // Bank doesn't exist in HMA, delete local copy
              await this.hashBankService.delete(Number(bank.id), orgId);
              return null;
            }

            if (!response.ok) {
              // eslint-disable-next-line no-console
              console.error(`Failed to verify bank ${bank.hma_name} in HMA service: ${response.status}`);
            }

            return bank;
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Network error verifying bank ${bank.hma_name}:`, error);
            return bank;
          }
        })
      );

      return validBanks.filter((bank): bank is HashBank => bank !== null);
    } catch (error) {
      return [];
    }
  }

  async getExchangeApis(): Promise<ExchangeApiInfo[]> {
    const apisResponse = await this.fetchHTTP({
      url: `${this.hmaServiceUrl}/c/exchanges/apis`,
      method: 'get',
      handleResponseBody: 'as-json',
    });

    if (!apisResponse.ok) {
      throw new Error(`Failed to fetch exchange APIs: ${apisResponse.status}`);
    }

    const apiNames = apisResponse.body as unknown as string[];

    const infos = await Promise.all(
      apiNames.map(async (name) => {
        try {
          const configResponse = await this.fetchHTTP({
            url: `${this.hmaServiceUrl}/c/exchanges/api/${encodeURIComponent(name)}`,
            method: 'get',
            handleResponseBody: 'as-json',
          });

          if (configResponse.ok) {
            const body = configResponse.body as unknown as {
              supports_authentification: boolean;
              has_set_authentification: boolean;
            };
            return {
              name,
              supports_auth: body.supports_authentification,
              has_auth: body.has_set_authentification,
            };
          }
        } catch {
          // fall through to default
        }
        return { name, supports_auth: false, has_auth: false };
      })
    );
    return infos;
  }

  async getExchangeApiSchema(apiName: string): Promise<ExchangeApiSchema> {
    try {
      const response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/exchanges/api/${encodeURIComponent(apiName)}/schema`,
        method: 'get',
        handleResponseBody: 'as-json',
      });

      if (response.ok) {
        return response.body as unknown as ExchangeApiSchema;
      }
    } catch {
      // Fall through to built-in schemas
    }

    const fallback = KNOWN_EXCHANGE_SCHEMAS[apiName];
    if (fallback) {
      return fallback;
    }

    return { config_schema: { fields: [] }, credentials_schema: null };
  }

  async createExchange(
    bankName: string,
    apiType: string,
    apiJson: Record<string, unknown>
  ): Promise<void> {
    const requestBody = {
      bank: bankName,
      api: apiType,
      api_json: apiJson,
    };

    const response = await this.fetchHTTP({
      url: `${this.hmaServiceUrl}/c/exchanges`,
      method: 'post',
      body: jsonStringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      handleResponseBody: 'as-json',
    });

    if (!response.ok) {
      const errorDetails = {
        status: response.status,
        responseBody: response.body,
        requestBody,
        url: `${this.hmaServiceUrl}/c/exchanges`,
      };
      throw new Error(`Failed to create exchange: ${jsonStringify(errorDetails)}`);
    }
  }

  async setExchangeCredentials(
    apiName: string,
    credentialJson: Record<string, unknown>
  ): Promise<void> {
    const requestBody = { credential_json: credentialJson };

    const response = await this.fetchHTTP({
      url: `${this.hmaServiceUrl}/c/exchanges/api/${encodeURIComponent(apiName)}`,
      method: 'post',
      body: jsonStringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      handleResponseBody: 'discard',
    });

    if (!response.ok) {
      throw new Error(
        `Failed to set exchange credentials for '${apiName}': status=${response.status}`
      );
    }
  }

  async getExchangeForBank(hmaName: string): Promise<ExchangeInfo | null> {
    let response;
    try {
      response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/exchange/${encodeURIComponent(hmaName)}`,
        method: 'get',
        handleResponseBody: 'as-json',
      });
    } catch (err) {
      return {
        api: '',
        enabled: false,
        has_auth: false,
        error: `Unable to reach HMA service: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return {
        api: '',
        enabled: false,
        has_auth: false,
        error: `Failed to fetch exchange info from HMA (status ${response.status})`,
      };
    }

    const body = response.body as unknown as Record<string, unknown>;
    const apiName = String(body.api ?? '');

    let hasAuth = false;
    try {
      const apiResponse = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/exchanges/api/${encodeURIComponent(apiName)}`,
        method: 'get',
        handleResponseBody: 'as-json',
      });
      if (apiResponse.ok) {
        const apiBody = apiResponse.body as unknown as {
          has_set_authentification: boolean;
        };
        hasAuth = apiBody.has_set_authentification;
      }
    } catch {
      // Non-critical: can't determine auth status
    }

    const info: ExchangeInfo = {
      api: apiName,
      enabled: Boolean(body.enabled),
      has_auth: hasAuth,
    };

    try {
      const statusResponse = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/exchange/${encodeURIComponent(hmaName)}/status`,
        method: 'get',
        handleResponseBody: 'as-json',
      });
      if (statusResponse.ok) {
        const status = statusResponse.body as unknown as {
          last_fetch_succeeded: boolean;
          last_fetch_complete_ts: number | null;
          up_to_date: boolean;
          fetched_items: number;
          running_fetch_start_ts: number | null;
        };
        info.last_fetch_succeeded = status.last_fetch_succeeded;
        info.up_to_date = status.up_to_date;
        info.fetched_items = status.fetched_items;
        info.is_fetching = status.running_fetch_start_ts != null;
        if (status.last_fetch_complete_ts != null) {
          info.last_fetch_time = new Date(status.last_fetch_complete_ts * 1000).toISOString();
        }
      }
    } catch {
      // Non-critical: can't determine fetch status
    }

    return info;
  }

  async hashContentFromUrl(url: string): Promise<Record<string, string>> {
    const response = await this.fetchHTTP({
      url: `${this.hmaServiceUrl}/h/hash?url=${encodeURIComponent(url)}`,
      method: 'get',
      handleResponseBody: 'as-json',
    });

    if (!response.ok) {
      throw new Error(`Failed to hash content from URL: ${response.status}`);
    }

    return response.body as unknown as Record<string, string>;
  }

  async addContentToBank(
    bankName: string,
    options: {
      file?: File | Blob;
      contentType?: ContentType;
      url?: string;
      metadata?: {
        content_id?: string;
        content_uri?: string;
        json?: Record<string, unknown>;
      };
    }
  ): Promise<BankContentResponse> {
    const { file, contentType, url, metadata } = options;

    if (!file && !url) {
      throw new Error('Either file or url must be provided');
    }

    let response;
    if (url) {
      // URL-based content
      const params = new URLSearchParams();
      params.append('url', url);
      if (metadata) {
        if (metadata.content_id) params.append('content_id', metadata.content_id);
        if (metadata.content_uri) params.append('content_uri', metadata.content_uri);
        if (metadata.json) params.append('metadata', jsonStringify(metadata.json));
      }

      response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bankName}/content?${params.toString()}`,
        method: 'post',
        handleResponseBody: 'as-json',
      });
    } else {
      // File upload
      const formData = new FormData();
      formData.append(contentType!, file!);

      if (metadata) {
        if (metadata.content_id) formData.append('content_id', metadata.content_id);
        if (metadata.content_uri) formData.append('content_uri', metadata.content_uri);
        if (metadata.json) formData.append('metadata', jsonStringify(metadata.json));
      }

      response = await this.fetchHTTP({
        url: `${this.hmaServiceUrl}/c/bank/${bankName}/content`,
        method: 'post',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: formData as any,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        handleResponseBody: 'as-json',
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to add content to bank: ${response.status}`);
    }

    return response.body as unknown as BankContentResponse;
  }

  async lookupContent(
    options: {
      url?: string;
      contentType?: ContentType;
      signalType?: string;
      signal?: string;
    }
  ): Promise<LookupResponse> {
    const { url, contentType, signalType, signal } = options;

    const params = new URLSearchParams();
    if (url) params.append('url', url);
    if (contentType) params.append('content_type', contentType);
    if (signalType) params.append('signal_type', signalType);
    if (signal) params.append('signal', signal);

    const response = await this.fetchHTTP({
      url: `${this.hmaServiceUrl}/m/lookup?${params.toString()}`,
      method: 'get',
      handleResponseBody: 'as-json',
    });

    if (!response.ok) {
      throw new Error(`Failed to lookup content: ${response.status}`);
    }

    return response.body as unknown as LookupResponse;
  }

  /**
   * Checks if an image matches any images in any of the provided hash banks
   * and returns detailed match information
   * @param hmaBankIds Array of hash bank IDs to check against
   * @param signalType The type of signal (e.g. 'pdq', 'md5', etc.)
   * @param signal The hash value to check
   * @returns A promise that resolves to an object with matched status and list of matched banks
   */
  async checkImageMatchWithDetails(
    hmaBankIds: string[], 
    signalType: string, 
    signal: string
  ): Promise<{ matched: boolean; matchedBanks: string[] }> {
    const matches: LookupResponse = await this.lookupContent({
      signal,
      signalType,
    });

    const matchedBanks: string[] = [];

    // Check which banks have matches
    hmaBankIds.forEach(bankId => {
      const bankMatches = matches[bankId];
      if (bankMatches && bankMatches.length > 0) {
        // TODO: Implement some configuration for the distance threshold
        matchedBanks.push(bankId);
      }
    });

    return {
      matched: matchedBanks.length > 0,
      matchedBanks,
    };
  }

  /**
   * Checks if an image matches any images in any of the provided hash banks
   * @param hmaBankIds Array of hash bank IDs to check against
   * @param signalType The type of signal (e.g. 'pdq', 'md5', etc.)
   * @param signal The hash value to check
   * @returns A promise that resolves to true if the image matches any images in any of the banks
   * @deprecated Use checkImageMatchWithDetails for more detailed information
   */
  async checkImageMatch(hmaBankIds: string[], signalType: string, signal: string): Promise<boolean> {
    const result = await this.checkImageMatchWithDetails(hmaBankIds, signalType, signal);
    return result.matched;
  }
}

export default inject(['fetchHTTP', 'KyselyPg'], HmaService);
