import React, { useMemo, useState } from 'react';
import { Form, Slider } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  useGQLCreateHashBankMutation, 
  useGQLUpdateHashBankMutation,
  useGQLHashBankByIdQuery,
  namedOperations,
  GQLHashBankByIdDocument
} from '../../../../graphql/generated';
import CoopModal from '../../components/CoopModal';
import FormHeader from '../../components/FormHeader';
import FormSectionHeader from '../../components/FormSectionHeader';
import NameDescriptionInput from '../../components/NameDescriptionInput';
import CoopButton from '../../components/CoopButton';
import FullScreenLoading from '../../../../components/common/FullScreenLoading';

const getSliderColor = (value: number) => {
  if (value === 0) return '#ff4d4f'; // red
  if (value < 1) return '#faad14'; // yellow
  return '#ffffff'; // white
};

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

  const showModal = () => {
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
  };

  const [createHashBank, createMutationParams] = useGQLCreateHashBankMutation({
    onError: (e) => {
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
        setModalInfo({
          title: 'Hash Bank Created',
          body: 'Your Hash Bank was successfully created!',
          buttonText: 'Done',
        });
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
    onError: (e) => {
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

  if (bankQueryError) {
    throw bankQueryError;
  }
  if (bankQueryLoading) {
    return <FullScreenLoading />;
  }

  const onCreateBank = async () => {
    createHashBank({
      variables: {
        input: {
          name: bankName,
          description: bankDescription,
          enabled_ratio: enabledRatio,
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

  const onHideModal = () => {
    hideModal();

    if (
      (createMutationParams.data?.createHashBank && 'data' in createMutationParams.data.createHashBank) ||
      (updateMutationParams.data?.updateHashBank && 'data' in updateMutationParams.data.updateHashBank)
    ) {
      navigate(-1);
    }
  };

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

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{id == null ? 'Create Hash Bank' : 'Update Hash Bank'}</title>
      </Helmet>
      <FormHeader
        title={id == null ? 'Create Hash Bank' : 'Update Hash Bank'}
      />
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
      
      <CoopButton
        title={id == null ? 'Create Hash Bank' : 'Save Changes'}
        loading={updateMutationParams.loading || createMutationParams.loading}
        onClick={id == null ? onCreateBank : onUpdateBank}
      />
      {modal}
    </div>
  );
}