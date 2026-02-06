import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import { ReactComponent as Pencil } from '@/icons/lni/Education/pencil.svg';
import { ReactComponent as Plus } from '@/icons/lni/Interface and Sign/plus.svg';
import { ReactComponent as TrashCan } from '@/icons/lni/Web and Technology/trash-can.svg';
import { gql } from '@apollo/client';
import { Input } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import CopyTextComponent from '../../../components/common/CopyTextComponent';
import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import { CoopModalFooterButtonProps } from '../components/CoopModalFooter';
import DashboardHeader from '../components/DashboardHeader';

import {
  GQLUserPenaltySeverity,
  GQLUserPermission,
  useGQLDeletePolicyMutation,
  useGQLPoliciesWithModelsQuery,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';
import { Tree, treeFromList, TreeNode } from '../../../utils/tree';
import { ModalInfo } from '../types/ModalInfo';

export type Policy = {
  id: string;
  name: string;
  penalty: GQLUserPenaltySeverity;
  policyText?: string;
  enforcementGuidelines?: string;
};

export type PoliciesDashboardState = {
  canEditPolicies: boolean;
  isEdited: boolean;
  policyTree: Tree<Policy>;
};

gql`
  fragment PolicyFields on Policy {
    id
    name
    policyText
    enforcementGuidelines
    parentId
    policyType
    userStrikeCount
    applyUserStrikeCountConfigToChildren
  }

  query Policies {
    myOrg {
      policies {
        ...PolicyFields
      }
    }
  }

  query PoliciesWithModels {
    myOrg {
      policies {
        ...PolicyFields
      }
    }
    me {
      permissions
    }
  }

  mutation AddPolicies($policies: [AddPolicyInput!]!) {
    addPolicies(policies: $policies) {
      policies {
        ...PolicyFields
      }
      failures
    }
  }

  mutation UpdatePolicy($input: UpdatePolicyInput!) {
    updatePolicy(input: $input) {
      ...PolicyFields
    }
  }

  mutation DeletePolicy($id: ID!) {
    deletePolicy(id: $id)
  }

  query IsDemoOrg {
    myOrg {
      isDemoOrg
    }
  }
`;

/**
 * Policy Dashboard screen
 */
export default function PoliciesDashboard() {
  const navigate = useNavigate();

  const { loading, error, data, refetch } = useGQLPoliciesWithModelsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const [deletePolicy] = useGQLDeletePolicyMutation();

  const [modalInfo, setModalInfo] = useState<ModalInfo>({
    visible: false,
    title: '',
    body: '',
    okText: 'OK',
    onOk: () => {},
    okIsDangerButton: false,
    cancelVisible: false,
  });
  const [policyTree, setPolicyTree] = useState<Tree<Policy>>(
    new Tree<Policy>('root', {
      id: '-1',
      name: 'root',
      penalty: GQLUserPenaltySeverity.None,
    }),
  );
  const [expandedPolicies, setExpandedPolicies] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const filteredPolicyTree = useMemo(() => {
    if (searchTerm.trim().length === 0) {
      return policyTree;
    }

    return policyTree.filterTree((policy) =>
      policy.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [policyTree, searchTerm]);

  const treeSize = policyTree.size();
  const policyNames = policyTree.getValues((policy) => policy.name);

  const onHideModal = () => {
    setModalInfo({ ...modalInfo, visible: false });
    refetch();
  };

  const permissions = data?.me?.permissions;
  const policyList = data?.myOrg?.policies;

  useMemo(() => {
    if (policyList) {
      setPolicyTree(
        treeFromList<Policy>(
          policyList,
          { id: '-1', name: 'root', penalty: GQLUserPenaltySeverity.None },
          (policy) => ({
            id: policy.id,
            name: policy.name,
            penalty: policy.penalty,
            policyText: policy.policyText,
            enforcementGuidelines: policy.enforcementGuidelines,
          }),
        ),
      );
    }
  }, [policyList]);

  const noPoliciesYet = useMemo(
    () => policyTree.root && policyTree.root.isLeaf,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policyTree.root, treeSize],
  );

  const toggleExpanded = (policyName: string) => {
    if (expandedPolicies.includes(policyName)) {
      setExpandedPolicies(expandedPolicies.filter((it) => it !== policyName));
    } else {
      setExpandedPolicies([...expandedPolicies, policyName]);
    }
  };

  useEffect(() => {
    if (searchTerm.length > 0) {
      // Expand all policies
      setExpandedPolicies(policyNames);
    } else {
      setExpandedPolicies([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const renderPolicy = (policy: TreeNode<Policy>) => {
    const children = policy.children.length ? (
      <div className="flex items-stretch h-full pb-8">
        <div className="flex w-px h-full mx-2 bg-slate-200" />
        <div className="flex flex-col justify-center w-full pl-8 mb-6">
          {policy.children.map((child, i) => (
            <div key={i} className="flex flex-col">
              {renderPolicy(child)}
            </div>
          ))}
        </div>
      </div>
    ) : null;

    const previewPolicyText = policy.value.policyText?.replace(/<[^>]+>/g, ' ');

    return (
      <div key={policy.key} className="flex flex-col w-full">
        <div className="flex flex-col items-stretch mb-6">
          <div
            className={`flex items-start justify-between pb-4 rounded-md border border-solid w-full bg-white border-slate-200`}
          >
            <div className="flex flex-col w-full">
              <div className="flex items-center gap-6 px-6 pt-6 pb-3">
                <div className="text-base font-bold text-start">
                  {policy.value?.name}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  ID: <CopyTextComponent value={policy.value.id} />
                </div>
                <div className="grow" />
              </div>
              <div className="flex flex-col justify-between text-slate-700 text-start">
                <div className="px-6">
                  {previewPolicyText ? (
                    <div className="max-two-lines">{previewPolicyText}</div>
                  ) : (
                    'No definition provided'
                  )}
                </div>
                <div className="my-4 divider" />
                <div className="flex flex-row justify-between px-6">
                  {policy.children.length ? (
                    <div
                      className="flex items-center gap-4 font-medium cursor-pointer text-primary fill-primary"
                      onClick={() => toggleExpanded(policy.value.name)}
                    >
                      <div>
                        {policy.children.length === 1
                          ? '1 Sub-Policy'
                          : `${policy.children.length} Sub-Policies`}
                      </div>
                      <div className="flex items-center justify-start gap-1.5">
                        {expandedPolicies.includes(policy.value.name) ? (
                          <ChevronUp className="flex text-xs" height="12px" />
                        ) : (
                          <ChevronDown className="flex text-xs" height="12px" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}
                  {userHasPermissions(permissions, [
                    GQLUserPermission.ManageOrg,
                  ]) ? (
                    <div className="flex flex-row self-end">
                      <div
                        onClick={() =>
                          navigate(
                            `/dashboard/policies/form?parentPolicyId=${policy.value.id}`,
                          )
                        }
                        className="flex flex-row items-center mr-12 cursor-pointer text-primary fill-primary"
                      >
                        <Plus height="12px" className="pr-2" />
                        Add Sub Policy
                      </div>
                      <div
                        onClick={() =>
                          navigate(
                            `/dashboard/policies/form/${policy.value.id}`,
                          )
                        }
                        className="flex flex-row items-center mr-12 cursor-pointer text-primary fill-primary"
                      >
                        <Pencil height="12px" className="pr-2" />
                        Edit
                      </div>
                      <div
                        onClick={() =>
                          setModalInfo({
                            visible: true,
                            title: `Delete ${policy.value.name} policy?`,
                            body: `Please confirm you'd like to delete this policy. This action cannot be undone.`,
                            okText: 'OK',
                            cancelText: 'Cancel',
                            onOk: () => {
                              deletePolicy({
                                variables: { id: policy.value.id },
                                onCompleted: onHideModal,
                                onError: () =>
                                  setModalInfo({
                                    visible: true,
                                    title: 'Error',
                                    body: 'Error deleting policy. Please try again.',
                                    okText: 'OK',
                                    onOk: onHideModal,
                                    okIsDangerButton: false,
                                    cancelVisible: false,
                                  }),
                              });
                            },
                            onCancel: onHideModal,
                            okIsDangerButton: true,
                            cancelVisible: true,
                          })
                        }
                        className="flex flex-row items-center cursor-pointer text-coop-alert-red fill-coop-alert-red"
                      >
                        <TrashCan height="12px" className="pr-2" />
                        Delete
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        {expandedPolicies.includes(policy.value.name) ? children : null}
      </div>
    );
  };

  const policies = useMemo(() => {
    return (
      <div className="flex flex-col items-stretch w-full mb-6">
        {filteredPolicyTree?.root.children.map(renderPolicy)}
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPolicyTree, treeSize, policyNames, noPoliciesYet]);

  const modalFooter: CoopModalFooterButtonProps[] = [
    {
      title: modalInfo.okText,
      type: modalInfo.okIsDangerButton ? 'danger' : 'primary',
      onClick: modalInfo.onOk,
    },
  ];
  if (modalInfo.cancelVisible) {
    modalFooter.unshift({
      title: 'Cancel',
      onClick: onHideModal,
      type: modalInfo.okIsDangerButton ? 'primary' : 'secondary',
    });
  }

  const modal = (
    <CoopModal
      title={modalInfo.title}
      visible={modalInfo.visible}
      onClose={onHideModal}
      footer={modalFooter}
    >
      {modalInfo.body}
    </CoopModal>
  );

  if (error) {
    throw error;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  const searchBar = (
    <Input
      key="searchBar"
      className="!w-48"
      placeholder="Search"
      value={searchTerm}
      onChange={(event) => setSearchTerm(event.target.value)}
      allowClear
      // Note: we autofocus here because the input component behaves weirdly
      // otherwise...specifically, after writing the first character (or
      // removing the last character when there's only a single character in the
      // field), it unfocuses automatically, which is an incredibly annoying
      // user experience. Instead, let's just autofocus. The users who aren't
      // trying to search won't care/notice, and the ones who are will be
      // grateful that it's already selected for them.
      autoFocus
    />
  );

  return (
    <div className="flex flex-col items-start">
      <Helmet>
        <title>Policies</title>
      </Helmet>
      <div className="w-full">
        <DashboardHeader
          title="Policies"
          subtitle="Create policy categories here so you can track metrics across various policies. You can assign each rule you create to one or more of these policies."
          rightComponent={
            userHasPermissions(permissions, [GQLUserPermission.ManageOrg]) ? (
              <CoopButton
                type="primary"
                onClick={() => navigate(`form`)}
                title="Create New Policy"
              />
            ) : null
          }
        />
      </div>
      {searchBar}
      <div className="flex flex-row items-stretch w-full mt-6">
        <div className="flex flex-col items-start w-full overflow-y-auto">
          {policies}
        </div>
      </div>
      {modal}
    </div>
  );
}
