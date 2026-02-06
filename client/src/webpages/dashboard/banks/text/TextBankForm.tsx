import { gql } from '@apollo/client';
import { Select } from 'antd';
import capitalize from 'lodash/capitalize';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';
import FormHeader from '../../components/FormHeader';
import FormSectionHeader from '../../components/FormSectionHeader';
import NameDescriptionInput from '../../components/NameDescriptionInput';

import {
  GQLTextBankDocument,
  GQLTextBankType,
  GQLUserPermission,
  namedOperations,
  useGQLCreateTextBankMutation,
  useGQLTextBankFormQuery,
  useGQLTextBankQuery,
  useGQLUpdateTextBankMutation,
} from '../../../../graphql/generated';
import { userHasPermissions } from '../../../../routing/permissions';
import { titleCaseEnumString } from '../../../../utils/string';
import TextTokenInput from '../../rules/TextTokenInput';

const { Option } = Select;

export function bankTypeName(type: GQLTextBankType, plural: boolean) {
  switch (type) {
    case GQLTextBankType.String:
      return plural ? 'strings' : 'string';
    case GQLTextBankType.Regex:
      return plural ? 'regexes' : 'regex';
  }
}

gql`
  mutation CreateTextBank($input: CreateTextBankInput!) {
    createTextBank(input: $input) {
      success
      error
    }
  }

  mutation UpdateTextBank($input: UpdateTextBankInput!) {
    updateTextBank(input: $input) {
      success
      error
    }
  }

  query TextBank($id: ID!) {
    textBank(id: $id) {
      id
      name
      description
      type
      strings
    }
  }

  query TextBankForm {
    me {
      permissions
    }
  }
`;

export default function TextBankForm() {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInfo, setModalInfo] = useState<{
    title: string;
    body: string;
    buttonText: string;
  }>({ title: '', body: '', buttonText: '' });
  const [bankType, setBankType] = useState<GQLTextBankType>(
    GQLTextBankType.String,
  );
  const [strings, setStrings] = useState<string[]>([]);
  const [bankName, setBankName] = useState('');
  const [bankDescription, setBankDescription] = useState('');

  const showModal = () => {
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
  };

  const [createTextBank, createMutationParams] = useGQLCreateTextBankMutation({
    onError: (e) => {
      setModalInfo({
        title: 'Error Creating Text Bank',
        body: 'We encountered an error trying to create your Text Bank. Please try again.',
        buttonText: 'OK',
      });
      showModal();
    },
    onCompleted: (result) => {
      const { success, error } = result.createTextBank;
      if (success) {
        setModalInfo({
          title: 'Text Bank Created',
          body: 'Your Text Bank was successfully created!',
          buttonText: 'Done',
        });
        showModal();
        return;
      }

      if (error) {
        switch (error) {
          case 'BANK_NAME_EXISTS':
            setModalInfo({
              title: 'Error Creating Text Bank',
              body: 'Your organization already has a text bank with this name.',
              buttonText: 'OK',
            });
            showModal();
        }
      }
    },
  });

  const [updateTextBank, updateMutationParams] = useGQLUpdateTextBankMutation({
    onError: (e) => {
      setModalInfo({
        title: 'Error Updating Text Bank',
        body: 'We encountered an error trying to update your Text Bank. Please try again.',
        buttonText: 'OK',
      });
      showModal();
    },
    onCompleted: (result) => {
      const { success, error } = result.updateTextBank;
      if (success) {
        setModalInfo({
          title: 'Text Bank Updated',
          body: 'Your Text Bank was successfully updated!',
          buttonText: 'Done',
        });
        showModal();
        return;
      }

      if (error) {
        switch (error) {
          case 'BANK_NAME_EXISTS':
            setModalInfo({
              title: 'Error Updating Text Bank',
              body: 'Your organization already has a text bank with this name.',
              buttonText: 'OK',
            });
            showModal();
        }
      }
    },
  });

  const createMutationData = createMutationParams.data;
  const updateMutationData = updateMutationParams.data;

  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const bankQueryParams = useGQLTextBankQuery({
    variables: { id: id! }, // non-null assertion safe b/c of `skip` below.
    skip: id == null,
    fetchPolicy: 'no-cache',
  });
  const bank = bankQueryParams.data?.textBank;
  const bankQueryLoading = bankQueryParams.loading;
  const bankQueryError = bankQueryParams.error;

  const bankFormQueryParams = useGQLTextBankFormQuery();
  const permissions = bankFormQueryParams.data?.me?.permissions;
  const bankFormQueryLoading = bankFormQueryParams.loading;
  const bankFormQueryError = bankFormQueryParams.error;

  useMemo(() => {
    if (bank != null) {
      setBankType(bank.type);
      setBankName(bank.name);
      setBankDescription(bank.description ?? '');
      setStrings(bank.strings.slice());
    }
  }, [bank]);

  if (bankQueryError || bankFormQueryError) {
    throw bankQueryError ?? bankFormQueryError!;
  }
  if (bankQueryLoading || bankFormQueryLoading) {
    return <FullScreenLoading />;
  }
  const canEditTextBanks = userHasPermissions(permissions, [
    GQLUserPermission.MutateLiveRules,
  ]);

  const onCreateBank = async () => {
    createTextBank({
      variables: {
        input: {
          name: bankName,
          description: bankDescription,
          type: bankType,
          strings,
        },
      },
      refetchQueries: [namedOperations.Query.TextBanks],
    });
  };

  const onUpdateBank = async () => {
    updateTextBank({
      variables: {
        input: {
          id: id!,
          name: bankName,
          description: bankDescription,
          type: bankType,
          strings,
        },
      },
      refetchQueries: [
        namedOperations.Query.TextBanks,
        { query: GQLTextBankDocument, variables: { id } },
      ],
    });
  };

  function TextBankFormSection(props: React.PropsWithChildren<{}>) {
    return <div className="flex flex-col justify-start">{props.children}</div>;
  }

  const divider = () => <div className="mt-5 divider mb-9" />;

  const bankTypeSection = (
    <TextBankFormSection>
      <FormSectionHeader
        title="Bank Type"
        subtitle={
          'Select the type of bank you\'d like to create. You can either create a "String" bank or a "Regex" bank. No bank can have both plaintext strings and regular expressions - that would lead to unexpected behavior.'
        }
      />
      <div className="mb-2 max-w-[80%] text-base">
        <ul>
          <li>
            <span className="font-semibold">String</span>: String banks hold
            plain text strings. If you plan to use this bank to compute Text
            Similarity scores, it must be a String bank.
          </li>
          <li>
            <span className="font-semibold">Regex</span>: Regex banks hold
            regular expressions, and can also hold plain text strings. Regex
            banks cannot be used to compute Text Similarity scores.
          </li>
        </ul>
      </div>
      <Select<GQLTextBankType>
        placeholder="Select bank type"
        showSearch
        dropdownMatchSelectWidth={false}
        onChange={(value) => setBankType(value)}
        value={bankType}
      >
        {Object.values(GQLTextBankType).map((type) => {
          return (
            <Option key={type} value={type}>
              {titleCaseEnumString(type)}
            </Option>
          );
        })}
      </Select>
    </TextBankFormSection>
  );

  const matchingStringsSection = bankType && (
    <TextBankFormSection>
      <FormSectionHeader
        title={`Matching ${capitalize(bankTypeName(bankType, true))}`}
        subtitle={`These are the ${bankTypeName(
          bankType,
          true,
        )} that we'll store in this bank`}
      />
      <TextTokenInput
        key="strings"
        uniqueKey="strings"
        placeholder={`Input ${bankTypeName(bankType, true)}`}
        updateTokenValues={setStrings}
        initialValues={strings}
      />
    </TextBankFormSection>
  );

  const createButton = (
    <CoopButton
      title={id == null ? 'Create Text Bank' : 'Save Changes'}
      disabled={!canEditTextBanks}
      loading={updateMutationParams.loading || createMutationParams.loading}
      disabledTooltipTitle="To edit Text Banks, ask your organization's admin to upgrade your role to Rules Manager or Admin."
      disabledTooltipPlacement="bottomLeft"
      onClick={id == null ? onCreateBank : onUpdateBank}
    />
  );

  const onHideModal = () => {
    hideModal();

    if (
      createMutationData?.createTextBank?.success ||
      updateMutationData?.updateTextBank?.success
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
        <title>{id == null ? 'Create Text Bank' : 'Update Text Bank'}</title>
      </Helmet>
      <FormHeader
        title={id == null ? 'Create Text Bank' : 'Update Text Bank'}
      />
      <NameDescriptionInput
        nameInitialValue={bankName}
        descriptionInitialValue={bankDescription}
        onChangeName={setBankName}
        onChangeDescription={setBankDescription}
      />
      {divider()}
      {bankTypeSection}
      {divider()}
      {matchingStringsSection}
      {divider()}
      {createButton}
      {modal}
    </div>
  );
}
