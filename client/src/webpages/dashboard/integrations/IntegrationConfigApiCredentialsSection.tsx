import { Button, Input } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import {
  GQLGoogleContentSafetyApiIntegrationApiCredential,
  GQLIntegrationApiCredential,
  GQLOpenAiIntegrationApiCredential,
  GQLZentropiIntegrationApiCredential,
} from '../../../graphql/generated';

export default function IntegrationConfigApiCredentialsSection(props: {
  name: string;
  setApiCredential: (cred: GQLIntegrationApiCredential) => void;
  apiCredential: GQLIntegrationApiCredential;
}) {
  const { setApiCredential, apiCredential } = props;

  const renderGoogleContentSafetyApiCredential = (
    apiCredential: GQLGoogleContentSafetyApiIntegrationApiCredential,
  ) => {
    return (
      <div className="flex flex-col w-1/2">
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
      <div className="flex flex-col w-1/2">
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

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col w-1/2">
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
        <div className="flex flex-col w-1/2">
          <div className="mb-2 font-semibold">Labeler Versions</div>
          {labelerVersions.map((version, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
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
              />
            </div>
          ))}
          <Button
            type="dashed"
            icon={<Plus size={14} />}
            onClick={addLabelerVersion}
            className="w-fit"
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

  const renderPluginCredential = (
    pluginCredential: { __typename: 'PluginIntegrationApiCredential'; credential: Record<string, unknown> },
  ) => {
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
          <div key={key} className="flex flex-col w-1/2">
            <div className="mb-1">
              {PLUGIN_FIELD_LABELS[key] ?? key}
            </div>
            <Input
              value={String(value ?? '')}
              onChange={(event) => {
                const next = { ...credential, [key]: event.target.value };
                setApiCredential({
                  __typename: 'PluginIntegrationApiCredential',
                  credential: next as import('../../../graphql/generated').Scalars['JSONObject'],
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
