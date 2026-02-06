import { GQLRuleEnvironment, GQLRuleStatus } from '../../../graphql/generated';

export default function RoundedTag(
  props: {
    title: string;
  } & (
    | { status: GQLRuleStatus }
    | { environment: GQLRuleEnvironment }
    | object
  ),
) {
  const { title } = props;

  const getColorsForStatus = (status: GQLRuleStatus) => {
    switch (status) {
      case GQLRuleStatus.Archived:
      case GQLRuleStatus.Deprecated:
        return 'text-white bg-[#a5a6f6]';
      case GQLRuleStatus.Background:
        return 'text-white bg-[#60a5fa]';
      case GQLRuleStatus.Draft:
        return 'text-gray-800 bg-gray-100';
      case GQLRuleStatus.Expired:
        return 'text-white bg-[#ef4444]';
      case GQLRuleStatus.Live:
        return 'text-white bg-[#59cba7]';
    }
  };

  const getBackgroundColorForEnvironment = (
    environment: GQLRuleEnvironment,
  ) => {
    switch (environment) {
      case GQLRuleEnvironment.Background:
      case GQLRuleEnvironment.Backtest:
        return 'bg-[#60a5fa]';
      case GQLRuleEnvironment.Manual:
        return 'bg-[#f8b195]';
      case GQLRuleEnvironment.Live:
      case GQLRuleEnvironment.Retroaction:
        return 'bg-[#59cba7]';
    }
  };

  const colors = (() => {
    if ('status' in props) {
      return getColorsForStatus(props.status);
    } else if ('environment' in props) {
      return `text-white ${getBackgroundColorForEnvironment(
        props.environment,
      )}`;
    }
    return 'text-gray-800 bg-gray-100';
  })();
  return (
    <div
      className={`inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-full text-sm font-medium whitespace-nowrap ${colors}`}
    >
     {title}
    </div>
  );
}
