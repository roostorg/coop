import { InputNumber, Select } from 'antd';

import {
  GQLIntegrationContextKind,
  GQLIntegrationContextMode,
  type GQLIntegrationContextOption,
  type GQLIntegrationContextSettingInput,
} from '../../../graphql/generated';

export type IntegrationContextSetting = GQLIntegrationContextSettingInput & {
  maxCount: number | null;
};

type IntegrationContextSettingsSectionProps = {
  options: readonly GQLIntegrationContextOption[];
  value: readonly IntegrationContextSetting[];
  onChange: (value: IntegrationContextSetting[]) => void;
  disabled: boolean;
};

const contextLabels: Record<
  GQLIntegrationContextKind,
  { label: string; help?: string; countLabel?: string }
> = {
  [GQLIntegrationContextKind.Thread]: {
    label: 'Thread context',
    help: 'Earlier messages in the conversation, oldest first.',
    countLabel: 'Max messages',
  },
  [GQLIntegrationContextKind.Parent]: {
    label: 'Parent item',
  },
};

function isCountedContext(
  option: GQLIntegrationContextOption,
): option is GQLIntegrationContextOption & {
  maxCountLimit: number;
  defaultMaxCount: number;
} {
  return option.maxCountLimit != null;
}

function isOff(
  option: GQLIntegrationContextOption,
  setting: IntegrationContextSetting,
) {
  return (
    setting.mode === GQLIntegrationContextMode.Off ||
    (setting.mode === GQLIntegrationContextMode.Default &&
      option.defaultMode === GQLIntegrationContextMode.Off)
  );
}

export default function IntegrationContextSettingsSection({
  options,
  value,
  onChange,
  disabled,
}: IntegrationContextSettingsSectionProps) {
  if (options.length === 0) {
    return null;
  }

  const settingFor = (option: GQLIntegrationContextOption) =>
    value.find((setting) => setting.kind === option.kind) ?? {
      kind: option.kind,
      mode: option.mode,
      maxCount: option.maxCount ?? null,
    };

  const updateSetting = (
    option: GQLIntegrationContextOption,
    update: Partial<IntegrationContextSetting>,
  ) => {
    const current = settingFor(option);
    onChange(
      options.map((candidate) =>
        candidate.kind === option.kind
          ? { ...current, ...update }
          : settingFor(candidate),
      ),
    );
  };

  return (
    <section className="border-t border-slate-200 pt-5">
      <h2 className="text-lg font-semibold text-zinc-800">
        Evaluation context
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Context Coop loads and sends to this integration&apos;s signals.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {options.map((option) => {
          const setting = settingFor(option);
          const labels = contextLabels[option.kind];
          const selectId = `integration-context-${option.kind.toLowerCase()}`;
          const countId = `${selectId}-count`;
          const countDisabled = disabled || isOff(option, setting);

          return (
            <div key={option.kind} className="flex flex-col gap-2">
              <label htmlFor={selectId} className="font-medium text-zinc-800">
                {labels.label}
              </label>
              {labels.help && (
                <div className="text-xs text-zinc-500">{labels.help}</div>
              )}
              <Select
                id={selectId}
                aria-label={labels.label}
                value={setting.mode}
                disabled={disabled}
                options={[
                  {
                    value: GQLIntegrationContextMode.Default,
                    label: `Use integration default (${
                      option.defaultMode === GQLIntegrationContextMode.Include
                        ? 'Include'
                        : 'Off'
                    })`,
                  },
                  {
                    value: GQLIntegrationContextMode.Include,
                    label: 'Include',
                  },
                  { value: GQLIntegrationContextMode.Off, label: 'Off' },
                ]}
                onChange={(mode) => updateSetting(option, { mode })}
              />
              {isCountedContext(option) && labels.countLabel != null && (
                <div className="flex flex-col">
                  <label htmlFor={countId} className="mb-1 text-sm">
                    {labels.countLabel}
                  </label>
                  <InputNumber
                    id={countId}
                    aria-label={labels.countLabel}
                    min={1}
                    max={option.maxCountLimit}
                    placeholder={`Default: ${option.defaultMaxCount}`}
                    value={setting.maxCount ?? undefined}
                    disabled={countDisabled}
                    onChange={(maxCount) =>
                      updateSetting(option, {
                        maxCount:
                          typeof maxCount === 'number' ? maxCount : null,
                      })
                    }
                  />
                  <div className="mt-1 text-xs text-zinc-500">
                    Up to {option.maxCountLimit}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
