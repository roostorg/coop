import { Button, Input } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  GQLGoogleContentSafetyApiIntegrationApiCredential,
  GQLIntegrationApiCredential,
  GQLOpenAiIntegrationApiCredential,
  GQLZentropiIntegrationApiCredential,
} from '../../../graphql/generated';
import { validateSentinelConfig } from './sentinelConfigValidation';

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

  // Sentinel's settings are stored as the same JSON blob as plugin
  // integrations, but have a fixed set of fields.
  const SENTINEL_FIELD_LABELS: Record<string, string> = {
    apiUrl: 'Sentinel API URL',
    topK: 'Top K (nearest neighbors to consider)',
    minScoreToConsider: 'Minimum score to consider (0–1)',
    threadContextWindowMinutes: 'Thread context window (minutes)',
    threadContextLimit: 'Thread context limit (max prior messages)',
  };
  const SENTINEL_NUMERIC_FIELDS = new Set([
    'topK',
    'minScoreToConsider',
    'threadContextWindowMinutes',
    'threadContextLimit',
  ]);

  // Text being typed into numeric fields, so input like "0." isn't reset
  // mid-edit.
  const [sentinelDrafts, setSentinelDrafts] = useState<Record<string, string>>(
    {},
  );

  const renderSentinelCredential = (pluginCredential: {
    __typename: 'PluginIntegrationApiCredential';
    credential: Record<string, unknown>;
  }) => {
    const credential = pluginCredential.credential ?? {};
    const errors = validateSentinelConfig(credential);
    return (
      <div className="flex flex-col gap-4">
        {Object.entries(SENTINEL_FIELD_LABELS).map(([key, label]) => (
          <div key={key} className={`flex flex-col ${inputWidthClass}`}>
            <div className="mb-1">{label}</div>
            <Input
              aria-label={label}
              status={
                errors[key] != null && credential[key] != null ? 'error' : ''
              }
              value={
                sentinelDrafts[key] ??
                (credential[key] == null ? '' : String(credential[key]))
              }
              onChange={(event) => {
                const raw = event.target.value;
                setSentinelDrafts((prev) => ({ ...prev, [key]: raw }));

                let next: Record<string, unknown>;
                if (raw.trim() === '') {
                  const { [key]: _removed, ...rest } = credential;
                  next = rest;
                } else if (SENTINEL_NUMERIC_FIELDS.has(key)) {
                  // Keep non-numeric text as a string so validation flags it.
                  const parsed = Number(raw);
                  next = {
                    ...credential,
                    [key]: Number.isNaN(parsed) ? raw : parsed,
                  };
                } else {
                  next = { ...credential, [key]: raw };
                }
                setApiCredential({
                  __typename: 'PluginIntegrationApiCredential',
                  credential:
                    next as import('../../../graphql/generated').Scalars['JSONObject'],
                });
              }}
              onBlur={() => {
                // Reformat to the parsed value when typing ends, e.g. "0.10" -> "0.1".
                const { [key]: _removed, ...rest } = sentinelDrafts;
                setSentinelDrafts(rest);
              }}
            />
            {errors[key] != null && credential[key] != null && (
              <div className="mt-1 text-sm text-red-500">{errors[key]}</div>
            )}
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
        return props.name === 'SENTINEL'
          ? renderSentinelCredential(apiCredential)
          : renderPluginCredential(apiCredential);
      default:
        throw new Error('Integration not implemented yet');
    }
  };

  return <div className="flex flex-col pb-4">{projectKeysInput()}</div>;
}
