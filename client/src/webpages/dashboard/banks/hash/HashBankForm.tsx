import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Slider, Switch, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  useGQLCreateHashBankMutation,
  useGQLUpdateHashBankMutation,
  useGQLUpdateExchangeCredentialsMutation,
  useGQLHashBankByIdQuery,
  useGQLExchangeApisQuery,
  useGQLExchangeApiSchemaLazyQuery,
  namedOperations,
  GQLHashBankByIdDocument,
  type GQLExchangeApiSchemaQuery,
} from '../../../../graphql/generated';
import CoopModal from '../../components/CoopModal';
import FormHeader from '../../components/FormHeader';
import FormSectionHeader from '../../components/FormSectionHeader';
import NameDescriptionInput from '../../components/NameDescriptionInput';
import CoopButton from '../../components/CoopButton';
import FullScreenLoading from '../../../../components/common/FullScreenLoading';

type SchemaField = GQLExchangeApiSchemaQuery['exchangeApiSchema'] extends
  | infer S
  | null
  | undefined
  ? S extends { config_schema: { fields: ReadonlyArray<infer F> } }
  ? F
  : never
  : never;

const EXCHANGE_DISPLAY_NAMES: Record<string, string> = {
  fb_threatexchange: 'Facebook ThreatExchange',
  ncmec: 'NCMEC',
  stop_ncii: 'StopNCII',
};

function formatEnumChoice(value: string): string {
  return value;
}

const getSliderColor = (value: number) => {
  if (value === 0) return '#ff4d4f';
  if (value < 1) return '#faad14';
  return '#ffffff';
};

function isCollectionType(type: string): boolean {
  return type.startsWith('set_of_') || type.startsWith('list_of_');
}

function coerceFieldValue(field: SchemaField, raw: string): unknown {
  if (field.type === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (field.type === 'boolean') {
    return raw === 'true';
  }
  if (isCollectionType(field.type)) {
    if (!raw.trim()) return [];
    const innerType = field.type.replace(/^(set_of_|list_of_)/, '');
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (innerType === 'number' ? Number(s) : s));
  }
  return raw;
}

function displayCollectionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value ?? '');
}

function DynamicSchemaFields({
  title,
  subtitle,
  fields,
  values,
  onChange,
}: {
  title: string;
  subtitle?: string;
  fields: ReadonlyArray<SchemaField>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const handleFieldChange = useCallback(
    (fieldName: string, field: SchemaField, raw: string) => {
      onChange({ ...values, [fieldName]: coerceFieldValue(field, raw) });
    },
    [values, onChange]
  );

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col justify-start">
      <FormSectionHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const label = field.name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div key={field.name} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">
                {label}
                {field.required && <span className="ml-1 text-red-500">*</span>}
              </label>
              {field.help && (
                <span className="text-xs text-zinc-500">{field.help}</span>
              )}

              {field.type === 'enum' && field.choices ? (
                <Select
                  value={
                    values[field.name] != null
                      ? String(values[field.name])
                      : undefined
                  }
                  placeholder={`Select ${label}`}
                  onChange={(val) => handleFieldChange(field.name, field, val)}
                  options={field.choices.map((c) => ({
                    label: formatEnumChoice(c),
                    value: c,
                  }))}
                  className="max-w-md"
                />
              ) : field.type === 'boolean' ? (
                <Switch
                  checked={values[field.name] === true}
                  onChange={(checked) =>
                    onChange({ ...values, [field.name]: checked })
                  }
                />
              ) : isCollectionType(field.type) ? (
                <Input
                  value={displayCollectionValue(values[field.name])}
                  placeholder="Enter comma-separated values"
                  onChange={(e) =>
                    handleFieldChange(field.name, field, e.target.value)
                  }
                  className="max-w-md"
                />
              ) : (
                <Input
                  value={
                    values[field.name] != null
                      ? String(values[field.name])
                      : ''
                  }
                  placeholder={
                    field.type === 'number'
                      ? 'Enter a number'
                      : `Enter ${label}`
                  }
                  type={field.type === 'number' ? 'number' : 'text'}
                  onChange={(e) =>
                    handleFieldChange(field.name, field, e.target.value)
                  }
                  className="max-w-md"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HashBankForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInfo, setModalInfo] = useState<{
    title: string;
    body: string;
    buttonText: string;
  }>({ title: '', body: '', buttonText: '' });

  const [bankName, setBankName] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [enabledRatio, setEnabledRatio] = useState(1.0);

  const [selectedExchangeApi, setSelectedExchangeApi] = useState<string | null>(null);
  const [exchangeConfigValues, setExchangeConfigValues] = useState<Record<string, unknown>>({});
  const [exchangeCredValues, setExchangeCredValues] = useState<Record<string, unknown>>({});

  const isCreating = id == null;

  const showModal = () => setModalVisible(true);
  const hideModal = () => setModalVisible(false);

  const exchangeApisQuery = useGQLExchangeApisQuery({ skip: !isCreating });
  const exchangeApis = useMemo(
    () => exchangeApisQuery.data?.exchangeApis ?? [],
    [exchangeApisQuery.data?.exchangeApis]
  );

  const [fetchSchema, schemaQuery] = useGQLExchangeApiSchemaLazyQuery();
  const schema = schemaQuery.data?.exchangeApiSchema;
  const schemaLoading = schemaQuery.loading;

  const selectedApiInfo = useMemo(
    () => exchangeApis.find((a) => a.name === selectedExchangeApi),
    [exchangeApis, selectedExchangeApi]
  );

  useEffect(() => {
    if (selectedExchangeApi) {
      fetchSchema({ variables: { apiName: selectedExchangeApi } });
      setExchangeConfigValues({});
      setExchangeCredValues({});
    }
  }, [selectedExchangeApi, fetchSchema]);

  const [editCredValues, setEditCredValues] = useState<Record<string, unknown>>({});
  const [showCredForm, setShowCredForm] = useState(false);

  useEffect(() => {
    if (schema) {
      const configDefaults: Record<string, unknown> = {};
      for (const f of schema.config_schema.fields) {
        if (f.default != null) configDefaults[f.name] = f.default;
      }
      setExchangeConfigValues(configDefaults);

      if (schema.credentials_schema) {
        const credDefaults: Record<string, unknown> = {};
        for (const f of schema.credentials_schema.fields) {
          if (f.default != null) credDefaults[f.name] = f.default;
        }
        setExchangeCredValues(credDefaults);
      }
    }
  }, [schema]);

  const [createHashBank, createMutationParams] = useGQLCreateHashBankMutation({
    onError: () => {
      setModalInfo({
        title: 'Error Creating Hash Bank',
        body: 'We encountered an error trying to create your Hash Bank. Please try again.',
        buttonText: 'OK',
      });
      showModal();
    },
    onCompleted: (result) => {
      const response = result.createHashBank;
      if ('data' in response) {
        const warning = 'warning' in response ? response.warning : null;
        if (warning) {
          setModalInfo({
            title: 'Hash Bank Created with Warning',
            body: String(warning),
            buttonText: 'OK',
          });
        } else {
          setModalInfo({
            title: 'Hash Bank Created',
            body: selectedExchangeApi
              ? 'Your Hash Bank was successfully created and connected to the exchange!'
              : 'Your Hash Bank was successfully created!',
            buttonText: 'Done',
          });
        }
        showModal();
        return;
      }

      if ('title' in response) {
        setModalInfo({
          title: 'Error Creating Hash Bank',
          body: 'Your organization already has a hash bank with this name.',
          buttonText: 'OK',
        });
        showModal();
      }
    },
  });

  const [updateHashBank, updateMutationParams] = useGQLUpdateHashBankMutation({
    onError: () => {
      setModalInfo({
        title: 'Error Updating Hash Bank',
        body: 'We encountered an error trying to update your Hash Bank. Please try again.',
        buttonText: 'OK',
      });
      showModal();
    },
    onCompleted: (result) => {
      const response = result.updateHashBank;
      if ('data' in response) {
        setModalInfo({
          title: 'Hash Bank Updated',
          body: 'Your Hash Bank was successfully updated!',
          buttonText: 'Done',
        });
        showModal();
        return;
      }

      if ('title' in response) {
        setModalInfo({
          title: 'Error Updating Hash Bank',
          body: 'Your organization already has a hash bank with this name.',
          buttonText: 'OK',
        });
        showModal();
      }
    },
  });

  const bankQueryParams = useGQLHashBankByIdQuery({
    variables: { id: id! },
    skip: id == null,
    fetchPolicy: 'no-cache',
  });
  const bank = bankQueryParams.data?.hashBankById;
  const bankQueryLoading = bankQueryParams.loading;
  const bankQueryError = bankQueryParams.error;

  useMemo(() => {
    if (bank != null) {
      setBankName(bank.name);
      setBankDescription(bank.description ?? '');
      setEnabledRatio(bank.enabled_ratio);
      form.setFieldsValue({
        name: bank.name,
        description: bank.description ?? '',
        enabled_ratio: bank.enabled_ratio,
      });
    }
  }, [bank, form]);

  const bankExchangeApi = bank?.exchange?.api;

  const [updateExchangeCredentials, updateCredsMutationParams] =
    useGQLUpdateExchangeCredentialsMutation({
      onError: () => {
        setModalInfo({
          title: 'Error Updating Credentials',
          body: 'We encountered an error trying to update the exchange credentials. Please try again.',
          buttonText: 'OK',
        });
        showModal();
      },
      onCompleted: () => {
        setModalInfo({
          title: 'Credentials Updated',
          body: 'Exchange credentials have been updated successfully.',
          buttonText: 'Done',
        });
        showModal();
        setEditCredValues({});
        setShowCredForm(false);
      },
    });

  useEffect(() => {
    if (!isCreating && bankExchangeApi) {
      fetchSchema({ variables: { apiName: bankExchangeApi } });
    }
  }, [isCreating, bankExchangeApi, fetchSchema]);

  if (bankQueryError) {
    throw bankQueryError;
  }
  if (bankQueryLoading) {
    return <FullScreenLoading />;
  }

  const onCreateBank = async () => {
    const exchangeInput =
      selectedExchangeApi && schema
        ? {
          api_name: selectedExchangeApi,
          config_json: JSON.stringify(exchangeConfigValues),
          credentials_json:
            schema.credentials_schema &&
              selectedApiInfo &&
              !selectedApiInfo.has_auth
              ? JSON.stringify(exchangeCredValues)
              : undefined,
        }
        : undefined;

    createHashBank({
      variables: {
        input: {
          name: bankName,
          description: bankDescription,
          enabled_ratio: enabledRatio,
          exchange: exchangeInput,
        },
      },
      refetchQueries: [namedOperations.Query.HashBanks],
    });
  };

  const onUpdateBank = async () => {
    updateHashBank({
      variables: {
        input: {
          id: id!,
          name: bankName,
          description: bankDescription,
          enabled_ratio: enabledRatio,
        },
      },
      refetchQueries: [
        namedOperations.Query.HashBanks,
        { query: GQLHashBankByIdDocument, variables: { id } },
      ],
    });
  };

  const onUpdateCredentials = () => {
    if (!bankExchangeApi) return;
    updateExchangeCredentials({
      variables: {
        apiName: bankExchangeApi,
        credentialsJson: JSON.stringify(editCredValues),
      },
      refetchQueries: [
        namedOperations.Query.HashBanks,
        { query: GQLHashBankByIdDocument, variables: { id } },
      ],
    });
  };

  const onHideModal = () => {
    hideModal();

    if (
      (createMutationParams.data?.createHashBank && 'data' in createMutationParams.data.createHashBank) ||
      (updateMutationParams.data?.updateHashBank && 'data' in updateMutationParams.data.updateHashBank)
    ) {
      navigate(-1);
    }
  };

  const hasRequiredConfigMissing =
    selectedExchangeApi &&
    schema?.config_schema.fields.some(
      (f) =>
        f.required &&
        (exchangeConfigValues[f.name] == null ||
          exchangeConfigValues[f.name] === '')
    );

  const hasRequiredCredsMissing =
    selectedExchangeApi &&
    schema?.credentials_schema &&
    selectedApiInfo &&
    !selectedApiInfo.has_auth &&
    schema.credentials_schema.fields.some(
      (f) =>
        f.required &&
        (exchangeCredValues[f.name] == null ||
          exchangeCredValues[f.name] === '')
    );

  const isExchangeIncomplete = Boolean(hasRequiredConfigMissing) || Boolean(hasRequiredCredsMissing);

  const modal = (
    <CoopModal
      title={modalInfo.title}
      visible={modalVisible}
      onClose={onHideModal}
      footer={[
        {
          title: modalInfo.buttonText,
          onClick: onHideModal,
          type: 'primary',
        },
      ]}
    >
      {modalInfo.body}
    </CoopModal>
  );

  const exchangeApiDisplayName = bank?.exchange
    ? EXCHANGE_DISPLAY_NAMES[bank.exchange.api] ?? bank.exchange.api
    : null;

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{isCreating ? 'Create Hash Bank' : 'Update Hash Bank'}</title>
      </Helmet>
      <FormHeader
        title={isCreating ? 'Create Hash Bank' : 'Update Hash Bank'}
      />

      {!isCreating && bank?.exchange && (
        <>
          {bank.exchange.error ? (
            <div className="flex items-center gap-3 p-4 mb-6 border rounded-lg bg-red-50 border-red-200">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-red-900">
                  Exchange Error
                </span>
                <span className="mt-1 text-sm text-red-700">
                  {bank.exchange.error}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 mb-6 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-blue-900">
                    Connected to Exchange
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color="blue">{exchangeApiDisplayName}</Tag>
                    <Tag color={bank.exchange.enabled ? 'green' : 'default'}>
                      {bank.exchange.enabled ? 'Enabled' : 'Disabled'}
                    </Tag>
                    <Tag color={bank.exchange.has_auth ? 'green' : 'orange'}>
                      {bank.exchange.has_auth ? 'Credentials Set' : 'Credentials Missing'}
                    </Tag>
                    {bank.exchange.last_fetch_succeeded === false && (
                      <Tag color="red">Fetch Failed</Tag>
                    )}
                    {bank.exchange.last_fetch_succeeded === true && (
                      <Tag color="green">Fetch OK</Tag>
                    )}
                    {bank.exchange.is_fetching && (
                      <Tag color="processing">Fetching...</Tag>
                    )}
                  </div>
                  {bank.exchange.last_fetch_time && (
                    <span className="text-xs text-zinc-500">
                      Last fetch: {new Date(bank.exchange.last_fetch_time).toLocaleString()}
                      {bank.exchange.fetched_items != null && (
                        <> &middot; {bank.exchange.fetched_items} items</>
                      )}
                    </span>
                  )}
                  {bank.exchange.last_fetch_succeeded === false && (
                    <span className="text-xs text-red-600">
                      The last fetch from this exchange failed. Check that credentials are correct and the exchange service is reachable.
                    </span>
                  )}
                </div>
                {schema?.credentials_schema &&
                  schema.credentials_schema.fields.length > 0 && (
                    <Button
                      type="link"
                      onClick={() => {
                        setShowCredForm((prev) => !prev);
                        if (showCredForm) setEditCredValues({});
                      }}
                    >
                      {showCredForm ? 'Cancel' : 'Update Credentials'}
                    </Button>
                  )}
              </div>

              {showCredForm &&
                schema?.credentials_schema &&
                schema.credentials_schema.fields.length > 0 && (
                  <div className="mb-6">
                    <DynamicSchemaFields
                      title="Update Exchange Credentials"
                      subtitle="Enter new credentials to replace the existing ones."
                      fields={schema.credentials_schema.fields}
                      values={editCredValues}
                      onChange={setEditCredValues}
                    />
                    <div className="mt-4">
                      <CoopButton
                        title="Save Credentials"
                        loading={updateCredsMutationParams.loading}
                        disabled={
                          schema.credentials_schema.fields
                            .filter((f) => f.required)
                            .some(
                              (f) =>
                                editCredValues[f.name] == null ||
                                editCredValues[f.name] === ''
                            )
                        }
                        disabledTooltipTitle="Please fill in all required credential fields"
                        onClick={onUpdateCredentials}
                      />
                    </div>
                    <div className="mt-5 divider mb-9" />
                  </div>
                )}
            </>
          )}
        </>
      )}

      <NameDescriptionInput
        nameInitialValue={bankName}
        descriptionInitialValue={bankDescription}
        onChangeName={setBankName}
        onChangeDescription={setBankDescription}
      />

      <div className="mt-5 divider mb-9" />

      <div className="flex flex-col justify-start">
        <FormSectionHeader
          title="Enabled Ratio"
          subtitle="Control how much this hash bank is used for matching. 0 = Fully disabled, 1 = Fully enabled"
        />
        <div className="mb-2">
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={enabledRatio}
            marks={{
              0: 'Disabled',
              0.5: '50%',
              1: 'Enabled'
            }}
            tooltip={{
              formatter: (value) => `${Math.round((value ?? 0) * 100)}%`
            }}
            style={{
              '--ant-slider-track-background-color': getSliderColor(enabledRatio),
              maxWidth: '100%',
            } as React.CSSProperties}
            onChange={(value) => {
              setEnabledRatio(value);
            }}
          />
        </div>
        <div className="text-sm text-gray-500">
          0 = Fully disabled, 1 = Fully enabled
        </div>
      </div>

      <div className="mt-5 divider mb-9" />

      {isCreating && (
        <>
          <div className="flex flex-col justify-start">
            <FormSectionHeader
              title="Exchange Connection"
              subtitle="Optionally connect this bank to a signal exchange to automatically receive shared threat intelligence data."
            />
            <Select
              value={selectedExchangeApi ?? undefined}
              placeholder="No exchange (standalone bank)"
              allowClear
              onChange={(val) => setSelectedExchangeApi(val ?? null)}
              loading={exchangeApisQuery.loading}
              className="max-w-md"
              options={exchangeApis.map((api) => ({
                label: EXCHANGE_DISPLAY_NAMES[api.name] ?? api.name.replace(/_/g, ' '),
                value: api.name,
              }))}
            />
          </div>

          {selectedExchangeApi && schemaLoading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-zinc-500">
              <div className="w-4 h-4 border-2 rounded-full border-zinc-400 border-t-transparent animate-spin" />
              Loading exchange configuration...
            </div>
          )}

          {selectedExchangeApi && schema && !schemaLoading && (
            <>
              {schema.config_schema.fields.length > 0 && (
                <div className="mt-6">
                  <DynamicSchemaFields
                    title="Exchange Configuration"
                    subtitle="Configure the exchange-specific settings for this connection."
                    fields={schema.config_schema.fields}
                    values={exchangeConfigValues}
                    onChange={setExchangeConfigValues}
                  />
                </div>
              )}

              {schema.credentials_schema &&
                selectedApiInfo &&
                !selectedApiInfo.has_auth && (
                  <div className="mt-6">
                    <DynamicSchemaFields
                      title="Exchange Credentials"
                      subtitle="Provide authentication credentials for this exchange API. These credentials are shared across all exchanges of this type."
                      fields={schema.credentials_schema.fields}
                      values={exchangeCredValues}
                      onChange={setExchangeCredValues}
                    />
                  </div>
                )}

              {schema.credentials_schema &&
                selectedApiInfo?.has_auth && (
                  <div className="mt-4 p-3 text-sm rounded-md bg-emerald-50 text-emerald-700">
                    Credentials for this exchange API are already configured.
                  </div>
                )}
            </>
          )}

          <div className="mt-5 divider mb-9" />
        </>
      )}

      <CoopButton
        title={isCreating ? 'Create Hash Bank' : 'Save Changes'}
        loading={updateMutationParams.loading || createMutationParams.loading}
        disabled={isCreating && Boolean(isExchangeIncomplete)}
        disabledTooltipTitle={
          isExchangeIncomplete
            ? 'Please fill in all required exchange fields'
            : undefined
        }
        onClick={isCreating ? onCreateBank : onUpdateBank}
      />
      {modal}
    </div>
  );
}
