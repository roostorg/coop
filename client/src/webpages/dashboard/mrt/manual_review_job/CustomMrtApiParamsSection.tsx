import { Checkbox } from '@/coop-ui/Checkbox';
import { Label } from '@/coop-ui/Label';
import { useGQLActionsWithCustomParamsQuery } from '@/graphql/generated';
import { filterNullOrUndefined } from '@/utils/collections';
import { gql } from '@apollo/client';
import TextArea from 'antd/lib/input/TextArea';

gql`
  query ActionsWithCustomParams {
    myOrg {
      actions {
        ... on ActionBase {
          id
          name
        }
        ... on CustomAction {
          id
          name
          customMrtApiParams {
            name
            type
            displayName
          }
        }
      }
    }
  }
`;

export default function CustomMrtApiParamsSection(props: {
  selectedActionIds: string[];
  setCustomParamsForAction: (
    actionId: string,
    customParams: Record<string, string | boolean>,
  ) => void;
}) {
  const { selectedActionIds, setCustomParamsForAction } = props;

  const { data } = useGQLActionsWithCustomParamsQuery();
  const actions = data?.myOrg?.actions;
  if (!actions) {
    return null;
  }
  const actionsWithCustomParams = actions.filter(
    (action) =>
      action.__typename === 'CustomAction' &&
      action.customMrtApiParams !== undefined &&
      action.customMrtApiParams.length > 0,
  );

  return (
    <div className="flex flex-col mt-2 mb-4 gap-1">
      {actionsWithCustomParams.map((action) => {
        if (
          !selectedActionIds.includes(action.id) ||
          !('customMrtApiParams' in action)
        ) {
          return null;
        }
        const customParams = filterNullOrUndefined(action.customMrtApiParams);
        return customParams.map((actionParam) => {
          if (actionParam.type === 'BOOLEAN') {
            return (
              <div
                key={action.id + actionParam.displayName}
                className="flex items-center gap-2"
              >
                <Checkbox
                  id={`flag-checkbox-${action.id}-${actionParam.name}`}
                  onCheckedChange={(checked) =>
                    setCustomParamsForAction(action.id, {
                      [actionParam.name]: checked,
                    })
                  }
                />
                <Label htmlFor={`flag-checkbox-${action.id}`}>
                  {`"${action.name}" ${actionParam.displayName}`}
                </Label>
              </div>
            );
          } else if (actionParam.type === 'STRING') {
            return (
              <div
                key={action.id + actionParam.displayName}
                className="flex flex-col mb-4"
              >
                <Label
                  className="self-start my-2 font-bold"
                  htmlFor={`text-area-${action.id}-${actionParam.name}`}
                >
                  {`"${action.name}" ${actionParam.displayName}`}
                </Label>
                <TextArea
                  id={`text-area-${action.id}-${actionParam.name}`}
                  className="rounded-md"
                  placeholder=""
                  rows={2}
                  onChange={(e) =>
                    setCustomParamsForAction(action.id, {
                      [actionParam.name]: e.target.value,
                    })
                  }
                />
              </div>
            );
          } else {
            return null;
          }
        });
      })}
    </div>
  );
}
