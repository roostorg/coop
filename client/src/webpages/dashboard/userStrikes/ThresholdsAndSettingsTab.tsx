import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import {
  useGQLActionsQuery,
  useGQLSetAllUserStrikeThresholdMutation,
  useGQLUpdateUserStrikeTtlMutation,
  useGQLUserStrikeThresholdsQuery,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import { Check, Pencil, PlusIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';

import CoopSelect from '@/components/common/CoopSelect';
import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  query UserStrikeThresholds {
    myOrg {
      userStrikeThresholds {
        id
        threshold
        actions
      }
      userStrikeTTL
    }
  }
  mutation SetAllUserStrikeThreshold($input: SetAllUserStrikeThresholdsInput!) {
    setAllUserStrikeThresholds(input: $input) {
      ... on SetAllUserStrikeThresholdsSuccessResponse {
        _
      }
    }
  }
  mutation UpdateUserStrikeTTL($input: UpdateUserStrikeTTLInput!) {
    updateUserStrikeTTL(input: $input) {
      ... on UpdateUserStrikeTTLSuccessResponse {
        _
      }
    }
  }
`;

type Threshold = {
  id: string;
  threshold: number;
  actions: string[];
};

export default function ThresholdsTab() {
  const {
    data,
    error,
    loading,
    refetch: refetchThresholds,
  } = useGQLUserStrikeThresholdsQuery({
    fetchPolicy: 'network-only',
  });
  const {
    data: actionsData,
    error: actionsError,
    loading: actionsLoading,
  } = useGQLActionsQuery({});
  const [setUserStrikeThresholds] = useGQLSetAllUserStrikeThresholdMutation({
    onCompleted: async () => {
      await refetchThresholds();
    },
  });

  const [setUserStrikeTTL] = useGQLUpdateUserStrikeTtlMutation();

  const thresholds = data?.myOrg?.userStrikeThresholds;

  const orgActions = actionsData?.myOrg?.actions ?? [];

  if (error || actionsError) {
    throw new Error('Error fetching data');
  }
  if (loading || actionsLoading) {
    return <FullScreenLoading />;
  }
  return (
    <div className="flex flex-col gap-4">
      <ThresholdForm
        key={`thresholdForm-${thresholds?.toString()}`}
        thresholdSet={
          thresholds
            ? thresholds
                .map((t) => {
                  return {
                    id: t.id,
                    threshold: t.threshold,
                    actions: t.actions.map((a) => a),
                  };
                })
                .sort((a, b) => a.threshold - b.threshold)
            : []
        }
        orgActions={[...orgActions]}
        setThresholds={async (thresholds) => {
          await setUserStrikeThresholds({
            variables: {
              input: {
                thresholds: thresholds.map((t) => ({
                  // We don't need to send the ids
                  threshold: t.threshold,
                  actions: t.actions,
                })),
              },
            },
          });
        }}
      />
      <StrikeTTLForm
        orgTTL={data?.myOrg?.userStrikeTTL ?? 90}
        setTTL={async (ttl) => {
          await setUserStrikeTTL({
            variables: {
              input: {
                ttlDays: ttl,
              },
            },
          });
        }}
      />
    </div>
  );
}
function StrikeTTLForm(props: {
  orgTTL: number;
  setTTL: (ttl: number) => void;
}) {
  const { orgTTL, setTTL } = props;

  const [editingTTL, setEditingTTL] = useState<boolean>(false);
  const [ttlFormState, setTTLFormState] = useState<number>(orgTTL);

  const toggleEditing = () => {
    setEditingTTL(!editingTTL);
  };
  const discardChanges = () => {
    setTTLFormState(orgTTL);
    toggleEditing();
  };

  const editButton = (
    <div className="flex flex-row" onClick={() => toggleEditing()}>
      <Pencil height={18} width={18} className="text-xs text-primary" />
      <div className="pl-2 font-medium text-primary">Edit Window</div>
    </div>
  );

  return (
    <div>
      <div
        className={
          'flex flex-col p-4 rounded-md border border-solid cursor-pointer w-full bg-white border-slate-200'
        }
      >
        <div className="flex items-center justify-between gap-6 min-h-[46px]">
          <div className="text-base font-bold text-start">Strike Window</div>
          {editingTTL ? (
            <div className="flex flex-row gap-2">
              <div
                className="flex flex-row cursor-pointer items-center"
                onClick={() => {
                  discardChanges();
                }}
              >
                <Trash2
                  height={18}
                  width={18}
                  className="text-xs text-coop-alert-red "
                />
                <div className="pl-2 font-medium text-coop-alert-red">
                  Discard Changes
                </div>
              </div>
              <Button
                variant="outline"
                className="!fill-none"
                startIcon={Check}
                onClick={async () => {
                  setTTL(ttlFormState);
                  toggleEditing();
                }}
              >
                Save Strike Window
              </Button>
            </div>
          ) : (
            editButton
          )}
        </div>

        <div key={`TTL-Input`}>
          <div className="flex flex-row items-start mt-4 space-x-12 text-slate-700 text-start">
            <div className="flex flex-col mr-12 gap-3">
              <div className="text-sm">User strikes stay on record for</div>
              <div className="flex flex-row">
                <Input
                  type="number"
                  disabled={!editingTTL}
                  style={editingTTL ? { width: '3.5em' } : { width: '5.5em' }}
                  min={0}
                  max={365}
                  maxLength={3}
                  placeholder="90"
                  defaultValue={orgTTL}
                  value={ttlFormState + `${!editingTTL ? ' days' : ''}`}
                  onChange={(value) => {
                    if (value.target.value === '') {
                      setTTLFormState(0);
                    }
                    if (
                      !isNaN(parseInt(value.target.value)) &&
                      parseInt(value.target.value) >= 0
                    ) {
                      setTTLFormState(parseInt(value.target.value, 10));
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThresholdForm(props: {
  thresholdSet: Threshold[];
  orgActions: { id: string; name: string }[];
  setThresholds: (thresholds: Threshold[]) => void;
}) {
  const { thresholdSet, orgActions, setThresholds } = props;

  const [editingThresholds, setEditingThresholds] = useState<boolean>(false);
  const [thresholdFormState, setThresholdFormState] =
    useState<Threshold[]>(thresholdSet);

  const toggleEditing = () => {
    setEditingThresholds(!editingThresholds);
  };
  const discardChanges = () => {
    setThresholdFormState(thresholdSet);
    toggleEditing();
  };

  const editButton = (
    <div className="flex flex-row" onClick={() => toggleEditing()}>
      <Pencil height={18} width={18} className="text-xs text-primary " />
      <div className="pl-2 font-medium text-primary">Edit Thresholds</div>
    </div>
  );

  return (
    <div>
      <div
        className={
          'flex flex-col p-4 rounded-md border border-solid cursor-pointer w-full bg-white border-slate-200'
        }
      >
        <div className="flex items-center justify-between gap-6 min-h-[46px]">
          <div className="text-base font-bold text-start ">Thresholds</div>
          {editingThresholds ? (
            <div className="flex flex-row gap-2">
              <div
                className="flex flex-row cursor-pointer items-center"
                onClick={() => {
                  discardChanges();
                }}
              >
                <Trash2
                  height={18}
                  width={18}
                  className="text-xs text-coop-alert-red"
                />
                <div className="pl-2 font-medium text-coop-alert-red">
                  Discard Changes
                </div>
              </div>
              <Button
                variant="outline"
                className="!fill-none"
                startIcon={Check}
                onClick={async () => {
                  setThresholds(thresholdFormState);
                  toggleEditing();
                }}
              >
                Save Thresholds
              </Button>
            </div>
          ) : (
            editButton
          )}
        </div>
        <div className="pb-4">
          {thresholdFormState.length > 0
            ? thresholdFormState.map((it) => (
                <EditableThreshold
                  key={`thresholdForm-${it.threshold}-${it.id}`}
                  thresholdRule={it}
                  editing={editingThresholds}
                  actionOptions={orgActions}
                  deleteThreshold={(threshold) => {
                    setThresholdFormState(
                      thresholdFormState.filter((it) => it.id !== threshold.id),
                    );
                  }}
                  setThreshold={(threshold) => {
                    const index = thresholdFormState.findIndex(
                      (i) => i.id === threshold.id,
                    );
                    if (index === -1) {
                      return;
                    }
                    const newFormState = [...thresholdFormState];
                    newFormState.splice(index, 1, threshold);
                    setThresholdFormState(newFormState);
                  }}
                />
              ))
            : null}
        </div>
        {editingThresholds ? (
          <div className="flex flex-row items-start">
            <Button
              variant="outline"
              startIcon={PlusIcon}
              onClick={() => {
                const newThreshold = {
                  id: `new-${Math.random()}`,
                  threshold:
                    thresholdFormState.length === 0
                      ? 1
                      : thresholdFormState[thresholdFormState.length - 1]
                          .threshold + 1,
                  actions: [],
                };
                setThresholdFormState([...thresholdFormState, newThreshold]);
              }}
            >
              Add Threshold
            </Button>
          </div>
        ) : (
          <div className="min-h-[46px] py-4" />
        )}
      </div>
    </div>
  );
}

function EditableThreshold(props: {
  thresholdRule: Threshold;
  editing: boolean;
  actionOptions: readonly { id: string; name: string }[];
  setThreshold: (threshold: Threshold) => void;
  deleteThreshold: (threshold: Threshold) => void;
}) {
  const { thresholdRule, actionOptions, setThreshold, deleteThreshold } = props;

  return (
    <div key={`threshold-input-${thresholdRule.threshold}`}>
      <div className="flex flex-row items-start mt-4 space-x-12 text-slate-700 text-start">
        <div className="flex flex-col mr-12 gap-3">
          <div className="text-sm">User Strike Score</div>
          <div className="flex flex-row items-center">
            <div className="mr-2">{'>'}</div>
            <Input
              disabled={!props.editing}
              style={{ width: '5em' }}
              type={props.editing ? 'number' : 'text'}
              min={1}
              max={1000}
              maxLength={3}
              placeholder="1"
              value={thresholdRule.threshold}
              defaultValue={thresholdRule.threshold}
              onChange={(value) => {
                if (value.target.value === '') {
                  setThreshold({
                    ...thresholdRule,
                    threshold: 0,
                  });
                }
                if (!isNaN(parseInt(value.target.value))) {
                  setThreshold({
                    ...thresholdRule,
                    threshold: parseInt(value.target.value, 10),
                  });
                }
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 ">
          <div className="text-sm">Actions</div>
          <CoopSelect
            disabled={!props.editing}
            value={thresholdRule.actions}
            options={
              actionOptions
                ? actionOptions.map((action) => {
                    return { label: action.name, value: action.id };
                  })
                : []
            }
            onDeselect={(e) => {
              // find the index of e in the thresholdRule.actions array and remove
              // it
              setThreshold({
                ...thresholdRule,
                actions: thresholdRule.actions.filter((it) => it !== e),
              });
            }}
            onSelect={(e) => {
              if (props.setThreshold && !thresholdRule.actions.includes(e)) {
                props.setThreshold({
                  ...thresholdRule,
                  actions: [...thresholdRule.actions, e],
                });
              }
            }}
          />
        </div>
        {props.editing ? (
          <div className="flex flex-col gap-3 ">
            <div>&nbsp;</div>

            <div
              className="flex flex-col gap-3"
              onClick={() => {
                deleteThreshold(thresholdRule);
              }}
            >
              <Trash2
                height={24}
                width={24}
                className="text-xs text-coop-alert-red "
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
