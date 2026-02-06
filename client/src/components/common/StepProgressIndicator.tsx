import { ReactComponent as Checkmark } from '@/icons/lni/Interface and Sign/checkmark.svg';
import { ReactComponent as MoreAlt } from '@/icons/lni/Interface and Sign/more-alt.svg';

// This governs which steps, if any, are clickable by the user.
// The options are:
//   'any' - all steps are clickable
//   'backwards-only' - only steps that have been completed are clickable
//   'none' - no steps are clickable
type ProgressNavigationMode = 'any' | 'backwards-only' | 'none';

// NB: onClick will only fire if it passes
type ProgressStep = {
  name: string;
  onClick: () => void;
};

function completedStepIcon() {
  return (
    <Checkmark className="w-6 h-6 p-1 text-white rounded-full bg-coop-blue fill-white stroke-white" />
  );
}

function currentStepIcon() {
  return (
    <MoreAlt className="w-6 h-6 p-1 text-white bg-gray-500 rounded-full fill-white stroke-white" />
  );
}

function futureStepIcon() {
  return (
    <MoreAlt className="w-6 h-6 p-1 text-gray-400 bg-white border border-gray-400 border-solid rounded-full fill-gray-400 stroke-gray-400" />
  );
}

export default function StepProgressIndicator(props: {
  steps: ProgressStep[];
  currentStepIndex: number;
  navigationMode: ProgressNavigationMode;
}) {
  const { steps, currentStepIndex, navigationMode } = props;

  if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
    throw new Error(
      `currentStep must be >= 0 and less than the number of steps (${steps.length} in this case)`,
    );
  }

  const stepComponents = steps
    .map((step, index) => {
      const isClickable =
        navigationMode === 'any' ||
        (navigationMode === 'backwards-only' && index < currentStepIndex);

      const icon = (() => {
        if (index < currentStepIndex) {
          return completedStepIcon();
        } else if (index === currentStepIndex) {
          return currentStepIcon();
        } else {
          return futureStepIcon();
        }
      })();

      return (
        <div
          className="flex flex-row items-center gap-2"
          key={index}
          onClick={() => isClickable && step.onClick()}
        >
          {icon}
          <div
            className={`${
              index < currentStepIndex
                ? 'text-coop-blue'
                : index === currentStepIndex
                ? 'text-gray-600'
                : 'text-gray-400'
            }`}
          >
            {step.name}
          </div>
        </div>
      );
    })
    .flatMap((step, index) =>
      index < steps.length - 1
        ? [step, <div key={index} className={`h-px grow bg-gray-300 mx-3`} />]
        : [step],
    );
  return (
    <div className="flex flex-row items-center w-full px-24 pt-6 pb-12">
      {stepComponents}
    </div>
  );
}
