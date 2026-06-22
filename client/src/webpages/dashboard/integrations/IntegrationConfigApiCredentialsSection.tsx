import { Button, Input, Select } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import {
  GQLGoogleContentSafetyApiIntegrationApiCredential,
  GQLIntegrationApiCredential,
  GQLOpenAiIntegrationApiCredential,
  GQLZentropiIntegrationApiCredential,
  GQLZentropiSelfHostedConfig,
} from '../../../graphql/generated';

export default function IntegrationConfigApiCredentialsSection(props: {
  name: string;
  setApiCredential: (cred: GQLIntegrationApiCredential) => void;
  apiCredential: GQLIntegrationApiCredential;
  compact?: boolean;
}) {
  const { setApiCredential, apiCredential, compact } = props;
  const inputWidthClass = compact ? 'w-full' : 'w-1/2';

  const renderGoogleContentSafetyApiCredential = (
    apiCredential: GQLGoogleContentSafetyApiIntegrationApiCredential,
  ) => {
    return (
      <div className={`flex flex-col ${inputWidthClass}`}>
        <div className="mb-1">API Key</div>
        <Input
          value={apiCredential.apiKey}
          onChange={(event) =>
            setApiCredential({
              ...apiCredential,
              apiKey: event.target.value,
            })
          }
        />
      </div>
    );
  };

  const renderOpenAiCredential = (
    apiCredential: GQLOpenAiIntegrationApiCredential,
  ) => {
    return (
      <div className={`flex flex-col ${inputWidthClass}`}>
        <div className="mb-1">API Key</div>
        <Input
          value={apiCredential.apiKey}
          onChange={(event) =>
            setApiCredential({
              ...apiCredential,
              apiKey: event.target.value,
            })
          }
        />
      </div>
    );
  };

  const renderZentropiCredential = (
    apiCredential: GQLZentropiIntegrationApiCredential,
  ) => {
    const labelerVersions = apiCredential.labelerVersions ?? [];
    const selfHosted = apiCredential.selfHosted ?? null;
    const isHosted = selfHosted == null;

    const updateLabelerVersion = (
      index: number,
      field: 'id' | 'label',
      value: string,
    ) => {
      const updated = labelerVersions.map((v, i) =>
        i === index ? { ...v, [field]: value } : v,
      );
      setApiCredential({ ...apiCredential, labelerVersions: updated });
    };

    const addLabelerVersion = () => {
      setApiCredential({
        ...apiCredential,
        labelerVersions: [
          ...labelerVersions,
          { __typename: 'ZentropiLabelerVersion' as const, id: '', label: '' },
        ],
      });
    };

    const removeLabelerVersion = (index: number) => {
      setApiCredential({
        ...apiCredential,
        labelerVersions: labelerVersions.filter((_, i) => i !== index),
      });
    };

    const updateSelfHosted = (patch: Partial<GQLZentropiSelfHostedConfig>) => {
      setApiCredential({
        ...apiCredential,
        selfHosted: {
          __typename: 'ZentropiSelfHostedConfig' as const,
          format: 'cope',
          baseUrl: '',
          model: '',
          ...selfHosted,
          ...patch,
        },
      });
    };

    const switchToHosted = () => {
      setApiCredential({ ...apiCredential, selfHosted: null });
    };

    const switchToSelfHosted = () => {
      setApiCredential({
        ...apiCredential,
        selfHosted: {
          __typename: 'ZentropiSelfHostedConfig' as const,
          format: 'cope',
          baseUrl: '',
          model: '',
        },
      });
    };

    return (
      <div className="flex flex-col gap-4">
        <div className={`flex flex-col ${inputWidthClass}`}>
          <div className="mb-1 font-semibold">Mode</div>
          <Select
            value={isHosted ? 'hosted' : 'self_hosted'}
            onChange={(value) => {
              if (value === 'hosted') {
                switchToHosted();
              } else {
                switchToSelfHosted();
              }
            }}
            options={[
              { value: 'hosted', label: 'Hosted (Zentropi API)' },
              { value: 'self_hosted', label: 'Self-hosted (vLLM)' },
            ]}
          />
        </div>

        {isHosted ? (
          <>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-1">API Key</div>
              <Input
                value={apiCredential.apiKey}
                onChange={(event) =>
                  setApiCredential({
                    ...apiCredential,
                    apiKey: event.target.value,
                  })
                }
              />
            </div>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-2 font-semibold">Labeler Versions</div>
              {labelerVersions.map((version, index) => (
                <div
                  key={index}
                  className={`flex gap-2 mb-2 ${compact ? 'flex-col' : 'flex-row items-center'}`}
                >
                  <Input
                    placeholder="Version ID"
                    value={version.id}
                    onChange={(event) =>
                      updateLabelerVersion(index, 'id', event.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Labeler Name"
                    value={version.label}
                    onChange={(event) =>
                      updateLabelerVersion(index, 'label', event.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="text"
                    icon={<Trash2 size={14} />}
                    onClick={() => removeLabelerVersion(index)}
                    danger
                    className={compact ? 'self-end' : ''}
                  />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<Plus size={14} className="inline-block" />}
                onClick={addLabelerVersion}
                className={compact ? 'w-full' : 'w-fit'}
              >
                Add Labeler Version
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-1">
                Base URL <span className="text-red-500">*</span>
              </div>
              <Input
                placeholder="http://localhost:8000"
                value={selfHosted.baseUrl}
                onChange={(event) =>
                  updateSelfHosted({ baseUrl: event.target.value })
                }
              />
            </div>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-1">
                Model <span className="text-red-500">*</span>
              </div>
              <Input
                placeholder="cope-model"
                value={selfHosted.model}
                onChange={(event) =>
                  updateSelfHosted({ model: event.target.value })
                }
              />
            </div>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-1">Format</div>
              <Select
                value={selfHosted.format}
                onChange={(value) => updateSelfHosted({ format: value })}
                options={[
                  { value: 'cope', label: 'CoPE (vLLM completions)' },
                  { value: 'openai_chat', label: 'OpenAI Chat' },
                ]}
              />
            </div>
            <div className={`flex flex-col ${inputWidthClass}`}>
              <div className="mb-1">API Key (optional)</div>
              <Input
                placeholder="Leave empty if no auth required"
                value={selfHosted.apiKey ?? ''}
                onChange={(event) =>
                  updateSelfHosted({
                    apiKey: event.target.value || undefined,
                  })
                }
              />
            </div>
            {selfHosted.format === 'openai_chat' && (
              <>
                <div className={`flex flex-col ${inputWidthClass}`}>
                  <div className="mb-1">
                    System Prompt Template
                    <span className="ml-1 text-gray-400 text-xs">
                      (use {'{criteria}'} for policy text)
                    </span>
                  </div>
                  <Input.TextArea
                    rows={3}
                    placeholder="You are a content moderator. Policy: {criteria}"
                    value={selfHosted.systemPromptTemplate ?? ''}
                    onChange={(event) =>
                      updateSelfHosted({
                        systemPromptTemplate: event.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className={`flex flex-col ${inputWidthClass}`}>
                  <div className="mb-1">
                    User Message Template
                    <span className="ml-1 text-gray-400 text-xs">
                      (use {'{content}'} for content text)
                    </span>
                  </div>
                  <Input.TextArea
                    rows={3}
                    placeholder="Content to evaluate: {content}"
                    value={selfHosted.userMessageTemplate ?? ''}
                    onChange={(event) =>
                      updateSelfHosted({
                        userMessageTemplate: event.target.value || undefined,
                      })
                    }
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const PLUGIN_FIELD_LABELS: Record<string, string> = {
    truePercentage: 'True percentage (0–100)',
  };

  const renderPluginCredential = (pluginCredential: {
    __typename: 'PluginIntegrationApiCredential';
    credential: Record<string, unknown>;
  }) => {
    const credential = pluginCredential.credential ?? {};
    const entries = Object.entries(credential).filter(
      ([key]) => key !== 'name',
    );
    const fieldsToShow =
      entries.length > 0
        ? entries
        : [['truePercentage', ''] as [string, unknown]];
    return (
      <div className="flex flex-col gap-4">
        {fieldsToShow.map(([key, value]) => (
          <div key={key} className={`flex flex-col ${inputWidthClass}`}>
            <div className="mb-1">{PLUGIN_FIELD_LABELS[key] ?? key}</div>
            <Input
              value={String(value ?? '')}
              onChange={(event) => {
                const next = { ...credential, [key]: event.target.value };
                setApiCredential({
                  __typename: 'PluginIntegrationApiCredential',
                  credential:
                    next as import('../../../graphql/generated').Scalars['JSONObject'],
                });
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  const projectKeysInput = () => {
    switch (apiCredential.__typename) {
      case 'GoogleContentSafetyApiIntegrationApiCredential':
        return renderGoogleContentSafetyApiCredential(apiCredential);
      case 'OpenAiIntegrationApiCredential':
        return renderOpenAiCredential(apiCredential);
      case 'ZentropiIntegrationApiCredential':
        return renderZentropiCredential(apiCredential);
      case 'PluginIntegrationApiCredential':
        return renderPluginCredential(apiCredential);
      default:
        throw new Error('Integration not implemented yet');
    }
  };

  return <div className="flex flex-col pb-4">{projectKeysInput()}</div>;
}
