import { Button } from '@/coop-ui/Button';
import { Loading } from '@/coop-ui/Button.stories';
import { CheckmarkFilled, PlusFilled, TrashCanFilled } from '@/icons';
import { treeFromList } from '@/utils/tree';
import { Input } from 'antd';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import CoopModal from '../components/CoopModal';

import {
  GQLUserPenaltySeverity,
  namedOperations,
  useGQLAddPoliciesMutation,
  useGQLPoliciesQuery,
  useGQLUpdatePolicyMutation,
  type GQLPolicy,
} from '../../../graphql/generated';
import MarkdownTextInput from './MarkdownTextInput';
import { Policy } from './PoliciesDashboard';

export type PolicyInputModalInfo = {
  onClose: () => void;
  existingPolicy?: Policy;
  parent?: { id: string; name: string };
};

export default function PolicyForm() {
  const { existingPolicyId } = useParams<{
    existingPolicyId: string | undefined;
  }>();
  const [searchParams] = useSearchParams();
  const parentPolicyId = searchParams.get('parentPolicyId');
  const navigate = useNavigate();
  const [policyName, setPolicyName] = useState<string | undefined>(undefined);
  const [policyText, setPolicyText] = useState<string | undefined>(undefined);
  const [parent, setParent] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [enforcementGuidelines, setEnforcementGuidelines] = useState<
    string | undefined
  >(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [showEnforcementGuidelines, setShowEnforcementGuidelines] =
    useState<boolean>(false);
  const [existingPolicy, setExistingPolicy] = useState<
    | Pick<GQLPolicy, 'id' | 'name' | 'enforcementGuidelines' | 'policyText'>
    | undefined
  >(undefined);
  const { data, loading } = useGQLPoliciesQuery();
  const [showSuccess, setShowSuccess] = useState(false);

  const [addPolicy, { loading: addPolicyLoading }] = useGQLAddPoliciesMutation({
    onError: () => setErrorMessage('Error saving policy. Please try again.'),
    refetchQueries: [
      namedOperations.Query.PoliciesWithModels,
      namedOperations.Query.Policies,
    ],
    awaitRefetchQueries: true,
  });

  const [updatePolicy, { loading: updatePolicyLoading }] =
    useGQLUpdatePolicyMutation({
      refetchQueries: [
        namedOperations.Query.PoliciesWithModels,
        namedOperations.Query.Policies,
      ],
      awaitRefetchQueries: true,
    });

  useEffect(() => {
    const existingPolicy = data?.myOrg?.policies?.find(
      (policy) => policy.id === existingPolicyId,
    );
    const parentPolicy = data?.myOrg?.policies?.find(
      (policy) => policy.id === parentPolicyId,
    );
    if (existingPolicy) {
      setPolicyName(existingPolicy.name);
      setPolicyText(existingPolicy.policyText ?? undefined);
      setEnforcementGuidelines(
        existingPolicy.enforcementGuidelines ?? undefined,
      );
      setShowEnforcementGuidelines(
        existingPolicy.enforcementGuidelines != null,
      );
      setExistingPolicy(existingPolicy);
      const parentOfExisting = data?.myOrg?.policies?.find(
        (policy) => policy.id === existingPolicy.parentId,
      );
      if (parentOfExisting) {
        setParent({ id: parentOfExisting.id, name: parentOfExisting?.name });
      }
    }
    if (parentPolicy) {
      setParent({ id: parentPolicy.id, name: parentPolicy.name });
    }
  }, [data, existingPolicyId, parentPolicyId]);

  if ((existingPolicyId || parentPolicyId) && loading) {
    return <Loading />;
  }

  const policyTree = treeFromList<Policy>(
    data?.myOrg?.policies ?? [],
    { id: '-1', name: 'root', penalty: GQLUserPenaltySeverity.None },
    (policy) => ({
      id: policy.id,
      name: policy.name,
      penalty: policy.penalty,
      policyText: policy.policyText,
      enforcementGuidelines: policy.enforcementGuidelines,
    }),
  );
  const parentNode = parent ? policyTree.find(parent.name) : undefined;

  const pathToParentNode = parentNode
    ? policyTree
        .getPathToNode(parentNode)
        // filter out root
        .filter((it) => it.value.id !== '-1')
    : [];

  const nameSection = (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-start gap-2">
        <div className="font-semibold">Policy Name</div>
        <Input
          className="w-full rounded"
          value={policyName}
          onChange={(event) => setPolicyName(event.target.value)}
        />
      </div>
    </div>
  );

  const policyTextSection = (
    <div className="flex flex-col items-start justify-center w-full gap-2 mt-4 text-start">
      <div className="font-semibold">Policy Definition</div>
      <MarkdownTextInput
        text={policyText}
        setText={setPolicyText}
        textSize="small"
      />
    </div>
  );

  const enforcementGuidelinesSection = (
    <div className="flex flex-col items-start justify-center w-full gap-2 mt-6 text-start">
      <div className="flex items-center gap-2 py-0 my-0">
        <div className="font-semibold">Enforcement Guidelines</div>
      </div>
      <MarkdownTextInput
        text={enforcementGuidelines}
        setText={setEnforcementGuidelines}
        textSize="small"
      />
    </div>
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

  const successModal = (
    <CoopModal
      title={existingPolicy ? `Changes Saved` : `Policy Created`}
      visible={showSuccess}
      footer={[
        {
          title: 'Done',
          onClick: () => navigate('/dashboard/policies'),
        },
      ]}
    >
      Your Policy was successfully {existingPolicy ? 'updated' : 'created'}.
    </CoopModal>
  );

  return (
    <div>
      <Helmet>
        <title>{existingPolicyId ? 'Edit Policy' : 'Create Policy'}</title>
      </Helmet>
      <div className="flex flex-row gap-4 mb-12 text-slate-600">
        Policies
        {pathToParentNode.map((node) => (
          <div key={node.value.id} className="flex flex-row gap-2">
            <div>/</div>
            {node.value.name}
          </div>
        ))}
        {existingPolicy && (
          <div className="flex flex-row gap-4 text-black">
            <div>/</div>
            <div className="font-semibold">{existingPolicy.name}</div>
          </div>
        )}
      </div>
      <div className="flex flex-row justify-between">
        {nameSection}
        <div className="flex flex-row items-center">
          {existingPolicy && (
            <div
              className="flex flex-row pr-4 text-red-800 cursor-pointer fill-red-800"
              onClick={() => {
                setPolicyName(existingPolicy.name);
                setEnforcementGuidelines(
                  existingPolicy.enforcementGuidelines ?? undefined,
                );
                setPolicyText(existingPolicy.policyText ?? undefined);
              }}
            >
              <TrashCanFilled className="w-6 h-6 mr-2" />
              Discard Changes
            </div>
          )}
          <Button
            variant="outline"
            startIcon={CheckmarkFilled}
            loading={addPolicyLoading || updatePolicyLoading}
            onClick={async () => {
              if (policyName == null || policyName?.length === 0) {
                setErrorMessage('Please enter a policy name.');
                return;
              }

              if (existingPolicy?.id) {
                await updatePolicy({
                  variables: {
                    input: {
                      id: existingPolicy.id,
                      policyText,
                      enforcementGuidelines,
                      name: policyName,
                      parentId: parent?.id ?? undefined,
                    },
                  },
                  onCompleted: () => setShowSuccess(true),
                  onError: () =>
                    setErrorMessage('Error saving policy. Please try again.'),
                });
              } else {
                await addPolicy({
                  variables: {
                    policies: [
                      {
                        policyText,
                        enforcementGuidelines,
                        name: policyName,
                        parentId: parent?.id ?? undefined,
                      },
                    ],
                  },
                  onCompleted: () => setShowSuccess(true),
                  onError: () =>
                    setErrorMessage('Error saving policy. Please try again.'),
                });
              }
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between py-2 text-sm text-slate-400">
        {parent
          ? `${existingPolicy ? 'Update' : 'Create'} Sub-Policy for ${
              parent.name
            }`
          : 'Top-Level Policy'}
      </div>
      {policyTextSection}
      {showEnforcementGuidelines ? (
        enforcementGuidelinesSection
      ) : (
        <div className="mt-4">
          <Button
            variant="link"
            onClick={() => setShowEnforcementGuidelines(true)}
            startIcon={PlusFilled}
          >
            Add Enforcement Guidelines
          </Button>
        </div>
      )}
      {errorModal}
      {successModal}
    </div>
  );
}
