import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Switch } from '@/coop-ui/Switch';
import {
  useGQLPoliciesQuery,
  useGQLUpdatePolicyMutation,
} from '@/graphql/generated';
import { Tree, treeFromList, TreeNode } from '@/utils/tree';
import omit from 'lodash/omit';
import { Check, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import CoopModal from '../components/CoopModal';
import Table from '../components/table/Table';
import FullScreenLoading from '@/components/common/FullScreenLoading';

export type Policy = {
  id: string;
  name: string;
  policyText?: string;
  enforcementGuidelines?: string;
  userStrikeCount: number;
  applyUserStrikeCountConfigToChildren: boolean;
};

export default function PolicyScoresTab() {
  const {
    loading,
    error,
    data,
    refetch: refetchAllPolicies,
  } = useGQLPoliciesQuery({ fetchPolicy: 'network-only' });
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [updatePolicy] = useGQLUpdatePolicyMutation({
    onCompleted: async () => {
      // Because of the cascading policy updates (i.e. parent policies affect
      // the children), we should refetch the whole policy tree when one is
      // updated
      refetchAllPolicies();
    },
    onError: () => {
      setErrorMessage('Error saving policy. Please try again.');
    },
  });

  const [policyTree, setPolicyTree] = useState<Tree<Policy>>(
    new Tree<Policy>('root', {
      id: '-1',
      name: 'root',
      userStrikeCount: 0,
      applyUserStrikeCountConfigToChildren: false,
    }),
  );
  const [expandedPolicies, setExpandedPolicies] = useState<string[]>([]);
  const [editingPolicies, setEditingPolicies] = useState<string[]>([]);

  const policyList = data?.myOrg?.policies;
  // We keep a map of policy IDs to the strike settings updated in the UI in
  // order to be able to send updates without opening a modal each time you
  // click edit policy
  const [updatedPolicyScores, setUpdatedPolicyScores] = useState<
    Record<string, Policy>
  >({});

  useEffect(() => {
    if (policyList) {
      setPolicyTree(
        treeFromList<Policy>(
          [...policyList].sort((a, b) => a.name.localeCompare(b.name)),
          {
            id: '-1',
            name: 'root',
            userStrikeCount: 0,
            applyUserStrikeCountConfigToChildren: false,
          },
          (policy) => ({
            id: policy.id,
            name: policy.name,
            userStrikeCount: policy.userStrikeCount,
            policyText: policy.policyText,
            enforcementGuidelines: policy.enforcementGuidelines,
            applyUserStrikeCountConfigToChildren:
              policy.applyUserStrikeCountConfigToChildren,
          }),
        ),
      );
    }
  }, [policyList]);

  const renderPolicy = useCallback(
    (policy: TreeNode<Policy>, disabled: boolean) => {
      const toggleExpanded = (policyName: string) => {
        if (expandedPolicies.includes(policyName)) {
          setExpandedPolicies(
            expandedPolicies.filter((it) => it !== policyName),
          );
        } else {
          setExpandedPolicies([...expandedPolicies, policyName]);
        }
      };
      const toggleEditing = (policyId: string) => {
        if (editingPolicies.includes(policyId)) {
          setEditingPolicies(editingPolicies.filter((it) => it !== policyId));
        } else {
          setEditingPolicies([...editingPolicies, policyId]);
        }
      };

      // flatten children while adding a property to denote their indentation
      // level
      function flattenPolicies(policy: TreeNode<Policy>, level = 0) {
        // Initialize the result array with the current policy
        let result = [
          {
            ...omit(policy, 'children'),
            level,
            hasChildren: policy.children.length > 0,
          },
        ];

        // Recursively flatten each child policy and append to result array
        if (policy.children && policy.children.length > 0) {
          for (const child of policy.children) {
            result = result.concat(flattenPolicies(child, level + 1));
          }
        }
        return result;
      }

      const flattenedChildPolicies = flattenPolicies(policy);
      // we want to remove the root node from the flattened list
      flattenedChildPolicies.shift();
      const childPolicyIds = flattenedChildPolicies.map((p) => p.value.id);

      const discardChanges = (policyId: string) => {
        const filteredScores = omit(updatedPolicyScores, [
          policyId,
          ...childPolicyIds,
        ]);
        setUpdatedPolicyScores({
          ...filteredScores,
        });
      };

      const savePolicyScores = async (policyId: string) => {
        // only update this policy and it's child policies, not the whole list
        // of policies
        await Promise.all(
          [policyId, ...childPolicyIds].map(async (key) => {
            if (updatedPolicyScores[key]) {
              return updatePolicy({
                variables: {
                  input: {
                    ...updatedPolicyScores[key],
                  },
                },
              });
            }
          }),
        );
      };

      // don't allow editing child policies when this is set to true
      const editingChildrenDisabled =
        updatedPolicyScores[policy.value.id]
          ?.applyUserStrikeCountConfigToChildren ??
        policy.value.applyUserStrikeCountConfigToChildren;

      const isTopLevel = !policy.parent || policy.parent.value.id === '-1';
      return (
        <div
          key={`${policy.key}-${policy.value.userStrikeCount}`}
          className="flex flex-col w-full"
        >
          <div className="flex flex-col items-stretch mb-6">
            <div
              className={`flex flex-col px-6 pt-6 pb-6 rounded-md border border-solid w-full bg-white border-slate-200 `}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between gap-6 min-h-[46px]">
                    <div className="text-base font-bold text-start">
                      {policy.value?.name}
                    </div>
                    <div className="grow" />
                    {disabled ? null : editingPolicies.includes(
                        policy.value.id,
                      ) ? (
                      <div className="flex flex-row items-center gap-4">
                        <div
                          className="flex flex-row items-center gap-2 cursor-pointer"
                          onClick={async () => {
                            discardChanges(policy.value.id);
                            if (expandedPolicies.includes(policy.value.name)) {
                              toggleExpanded(policy.value.name);
                            }
                            toggleEditing(policy.value.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-coop-alert-red " />
                          <div className="text-coop-alert-red">
                            Discard Changes
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="!fill-none"
                          startIcon={Check}
                          onClick={async () => {
                            await savePolicyScores(policy.value.id);
                            if (expandedPolicies.includes(policy.value.name)) {
                              toggleExpanded(policy.value.name);
                            }
                            toggleEditing(policy.value.id);
                          }}
                        >
                          Save Policy Scores
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex flex-row cursor-pointer"
                        onClick={() => {
                          if (!expandedPolicies.includes(policy.value.name)) {
                            toggleExpanded(policy.value.name);
                          }
                          toggleEditing(policy.value.id);
                        }}
                      >
                        <Pencil
                          height={18}
                          width={18}
                          className="text-xs text-primary"
                        />
                        <div className="pl-2 font-medium text-primary">
                          Edit Policy Scores
                        </div>
                      </div>
                    )}
                  </div>
                  {isTopLevel ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      Top-level Policy
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-row items-start gap-4 mt-4 text-start">
                <div className="flex flex-col gap-2 ">
                  <div className="text-sm">User Strike Score</div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!editingPolicies.includes(policy.value.id)}
                    value={
                      updatedPolicyScores[policy.value.id]?.userStrikeCount ??
                      policy.value.userStrikeCount
                    }
                    placeholder="1"
                    onChange={(value) => {
                      if (value.target.value === '') {
                        setUpdatedPolicyScores({
                          ...updatedPolicyScores,
                          [policy.value.id]: {
                            ...policy.value,
                            ...updatedPolicyScores[policy.value.id],
                            userStrikeCount: 0,
                          },
                        });
                      }
                      if (!isNaN(parseInt(value.target.value))) {
                        setUpdatedPolicyScores({
                          ...updatedPolicyScores,
                          [policy.value.id]: {
                            ...policy.value,
                            ...updatedPolicyScores[policy.value.id],
                            userStrikeCount: parseInt(value.target.value, 10),
                          },
                        });
                      }
                    }}
                  />
                </div>
                {policy.children.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm">Apply to sub-policies</div>
                    <div className="pt-4 ml-8">
                      <Switch
                        disabled={!editingPolicies.includes(policy.value.id)}
                        defaultChecked={
                          policy.value.applyUserStrikeCountConfigToChildren
                        }
                        onCheckedChange={(checked) => {
                          setUpdatedPolicyScores({
                            ...updatedPolicyScores,
                            [policy.value.id]: {
                              ...policy.value,
                              ...updatedPolicyScores[policy.value.id],
                              applyUserStrikeCountConfigToChildren: checked,
                            },
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {policy.children.length ? (
                <div className="flex items-center gap-4 pt-4 mb-2 text-sm text-slate-500">
                  <div>
                    {policy.children.length === 1
                      ? '1 Sub-Policy'
                      : `${policy.children.length} Sub-Policies`}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-500"></div>
                  <div
                    className="cursor-pointer flex items-center justify-start gap-1.5 whitespace-nowrap"
                    onClick={() => toggleExpanded(policy.value.name)}
                  >
                    {expandedPolicies.includes(policy.value.name)
                      ? 'Hide all'
                      : 'Show all'}
                    {expandedPolicies.includes(policy.value.name) ? (
                      <ChevronUp className="flex text-xs" />
                    ) : (
                      <ChevronDown className="flex text-xs" />
                    )}
                  </div>
                </div>
              ) : null}
              {expandedPolicies.includes(policy.value.name) &&
              flattenedChildPolicies.length > 0 ? (
                <ChildPoliciesTable
                  policies={flattenedChildPolicies}
                  editingDisabled={
                    editingChildrenDisabled ||
                    !editingPolicies.includes(policy.value.id)
                  }
                  updatedPolicyScores={updatedPolicyScores}
                  setUpdatedPolicyScores={setUpdatedPolicyScores}
                />
              ) : null}
            </div>
          </div>
        </div>
      );
    },
    [editingPolicies, expandedPolicies, updatedPolicyScores, updatePolicy],
  );
  const errorModal = (
    <CoopModal
      title="Error"
      visible={errorMessage != null}
      onClose={() => setErrorMessage(undefined)}
      footer={[
        {
          title: 'OK',
          onClick: () => setErrorMessage(undefined),
        },
      ]}
    >
      {errorMessage}
    </CoopModal>
  );

  const policies = useMemo(() => {
    return (
      <div className="flex flex-col items-stretch w-full mb-6">
        {policyTree?.root.children.map((p) => {
          return renderPolicy(p, false);
        })}
      </div>
    );
  }, [policyTree, renderPolicy]);

  if (error) {
    throw error;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-row items-stretch w-full mt-6">
        <div className="flex flex-col items-start w-full overflow-y-auto">
          {policies}
        </div>
      </div>
      {errorModal}
    </div>
  );
}

function ChildPoliciesTable(props: {
  policies: {
    value: Policy;
    level: number;
    hasChildren: boolean;
    parent: TreeNode<Policy> | undefined;
  }[];
  editingDisabled: boolean;
  updatedPolicyScores: Record<string, Policy>;
  setUpdatedPolicyScores: (
    value: React.SetStateAction<Record<string, Policy>>,
  ) => void;
}) {
  const {
    policies,
    editingDisabled,
    updatedPolicyScores,
    setUpdatedPolicyScores,
  } = props;
  const columns = useMemo(
    () => [
      {
        Header: 'Sub-Policy',
        accessor: 'name',
        canSort: false,
      },
      {
        Header: 'User Strike Score',
        accessor: 'userStrikeCount', // accessor is the "key" in the data
        canSort: false,
      },
      {
        Header: 'Apply to sub-policies',
        accessor: 'applyUserStrikeCountConfigToChildren', // accessor is the "key" in the data
        canSort: false,
      },
    ],
    [],
  );
  const tableData = useMemo(() => {
    return policies?.slice().map((policy) => {
      return {
        name: policy.value.name,
        userStrikeCount: (
          <Input
            type="number"
            min={0}
            max={100}
            disabled={editingDisabled}
            value={
              // order to display user strike values for the child policies
              // 1. if the parent is dictating child's value, show the parent's
              // most up to date value from the UI, if it exists
              // 2. if the paren't value hasn't been updated, use the parent's
              // original value
              // 3. if the parent isn't dictating the child's value, show the
              // most up to date user strike score for this policy from the UI
              // 4. if the value hasn't been updated in the UI, show this
              // policy's original value
              // TODO: if we want to support 3-levels of policies this logic
              // will need to account for the whole parent tree
              editingDisabled
                ? policy?.parent?.value.id
                  ? updatedPolicyScores[policy?.parent?.value.id]
                      ?.userStrikeCount ??
                    policy?.parent?.value?.userStrikeCount
                  : undefined
                : updatedPolicyScores[policy.value.id]?.userStrikeCount ??
                  policy.value.userStrikeCount
            }
            placeholder="1"
            onChange={(value) => {
              if (value.target.value === '') {
                setUpdatedPolicyScores({
                  ...updatedPolicyScores,
                  [policy.value.id]: {
                    ...policy.value,
                    ...updatedPolicyScores[policy.value.id],
                    userStrikeCount: 0,
                  },
                });
              }
              if (!isNaN(parseInt(value.target.value))) {
                setUpdatedPolicyScores({
                  ...updatedPolicyScores,
                  [policy.value.id]: {
                    ...policy.value,
                    ...updatedPolicyScores[policy.value.id],
                    userStrikeCount: parseInt(value.target.value, 10),
                  },
                });
              }
            }}
          />
        ),
        applyUserStrikeCountConfigToChildren: policy.hasChildren ? (
          <div className="mt-1">
            <Switch
              disabled={editingDisabled}
              onChange={(event) => {
                const { checked } = event.target as HTMLInputElement;
                setUpdatedPolicyScores({
                  ...updatedPolicyScores,
                  [policy.value.id]: {
                    ...policy.value,
                    ...updatedPolicyScores[policy.value.id],
                    applyUserStrikeCountConfigToChildren: checked,
                  },
                });
              }}
            />
          </div>
        ) : null,
      };
    });
  }, [editingDisabled, updatedPolicyScores, policies, setUpdatedPolicyScores]);
  return <Table columns={columns} data={tableData} disableFilter={true} />;
}
