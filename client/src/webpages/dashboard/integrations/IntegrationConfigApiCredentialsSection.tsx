import { Button, Input, Select } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import {
  GQLGoogleContentSafetyApiIntegrationApiCredential,
  GQLIntegrationApiCredential,
  GQLIntegrationConfigField,
  GQLIntegrationConfigFieldInputType,
  GQLOpenAiIntegrationApiCredential,
  GQLZentropiIntegrationApiCredential,
  Scalars,
} from '../../../graphql/generated';

export type PluginConfigField = Omit<GQLIntegrationConfigField, '__typename'>;

export default function IntegrationConfigApiCredentialsSection(props: {
  name: string;
  setApiCredential: (cred: GQLIntegrationApiCredential) => void;
  apiCredential: GQLIntegrationApiCredential;
  compact?: boolean;
  /** Fields declared by a plugin manifest; drives the plugin config form. */
  configurationFields?: readonly PluginConfigField[];
}) {
  const {
    setApiCredential,
    apiCredential,
    compact,
    configurationFields = [],
  } = props;
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

    const updateLabelerVersion = (
      index: number,
      field: 'id' | 'label' | 'labelerId',
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
          {
            __typename: 'ZentropiLabelerVersion' as const,
            id: '',
            label: '',
            labelerId: '',
          },
        ],
      });
    };

    const removeLabelerVersion = (index: number) => {
      setApiCredential({
        ...apiCredential,
        labelerVersions: labelerVersions.filter((_, i) => i !== index),
      });
    };

    return (
      <div className="flex flex-col gap-4">
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
                placeholder="Labeler ID (optional)"
                value={version.labelerId ?? ''}
                onChange={(event) =>
                  updateLabelerVersion(index, 'labelerId', event.target.value)
                }
                className="flex-1"
              />
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
    const setField = (key: string, value: string | string[]) =>
      setApiCredential({
        __typename: 'PluginIntegrationApiCredential',
        credential: {
          ...credential,
          [key]: value,
        } as Scalars['JSONObject']['output'],
      });

    if (configurationFields.length > 0) {
      return (
        <div className="flex flex-col gap-4">
          {configurationFields.map((field) => {
            const inputId = `integration-config-${field.key}`;
            const value = credential[field.key];
            const stringValue =
              value == null
                ? ''
                : typeof value === 'string'
                  ? value
                  : JSON.stringify(value);
            const commonProps = {
              id: inputId,
              value: stringValue,
              placeholder: field.placeholder ?? undefined,
              'aria-required': field.required,
            };
            return (
              <div
                key={field.key}
                className={`flex flex-col ${inputWidthClass}`}
              >
                <label htmlFor={inputId} className="mb-1">
                  {field.label}
                  {field.required && (
                    <span className="text-red-600" aria-hidden="true">
                      {' *'}
                    </span>
                  )}
                </label>
                {field.inputType ===
                GQLIntegrationConfigFieldInputType.Select ? (
                  <Select
                    id={inputId}
                    value={stringValue === '' ? undefined : stringValue}
                    placeholder={field.placeholder ?? 'Select an option'}
                    aria-required={field.required}
                    allowClear={!field.required}
                    options={(field.options ?? []).map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    onChange={(selected) => setField(field.key, selected ?? '')}
                  />
                ) : field.inputType ===
                  GQLIntegrationConfigFieldInputType.Array ? (
                  <Select
                    id={inputId}
                    mode="tags"
                    open={false}
                    suffixIcon={null}
                    tokenSeparators={[',']}
                    value={Array.isArray(value) ? value.map(String) : []}
                    placeholder={
                      field.placeholder ?? 'Type a value and press Enter'
                    }
                    aria-required={field.required}
                    onChange={(values) => setField(field.key, values)}
                  />
                ) : field.inputType ===
                  GQLIntegrationConfigFieldInputType.Password ? (
                  <Input.Password
                    {...commonProps}
                    autoComplete="off"
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                ) : field.inputType ===
                  GQLIntegrationConfigFieldInputType.Json ? (
                  <Input.TextArea
                    {...commonProps}
                    autoSize={{ minRows: 3, maxRows: 12 }}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                ) : (
                  <Input
                    {...commonProps}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                )}
                {field.description && (
                  <div className="mt-1 text-xs text-zinc-500">
                    {field.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

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
