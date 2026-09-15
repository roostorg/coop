import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/coop-ui/Collapsible';
import { Text } from '@/coop-ui/Typography';
import { Meta } from '@storybook/react';

export default {
  title: 'Components/Collapsible',
  component: Collapsible,
} as Meta<typeof Collapsible>;

export const Closed = () => (
  <Collapsible className="w-96">
    <CollapsibleTrigger className="px-3 py-2">
      Closed by default
    </CollapsibleTrigger>
    <CollapsibleContent className="px-3 pb-3">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        This content is hidden until the trigger is clicked.
      </Text>
    </CollapsibleContent>
  </Collapsible>
);

export const Open = () => (
  <Collapsible defaultOpen className="w-96">
    <CollapsibleTrigger className="px-3 py-2">
      Open by default
    </CollapsibleTrigger>
    <CollapsibleContent className="px-3 pb-3">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        This content is visible because `defaultOpen` is set.
      </Text>
    </CollapsibleContent>
  </Collapsible>
);

export const Nested = () => (
  <Collapsible
    defaultOpen
    className="w-96 divide-y divide-gray-200 dark:divide-neutral-700"
  >
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="px-3 py-2">
        Outer section
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3 pl-6">
        <Collapsible>
          <CollapsibleTrigger className="py-1 text-sm">
            Inner section A
          </CollapsibleTrigger>
          <CollapsibleContent className="pb-2 pl-4">
            <Text size="SM" className="text-gray-600 dark:text-neutral-400">
              Nested content A.
            </Text>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible>
          <CollapsibleTrigger className="py-1 text-sm">
            Inner section B
          </CollapsibleTrigger>
          <CollapsibleContent className="pb-2 pl-4">
            <Text size="SM" className="text-gray-600 dark:text-neutral-400">
              Nested content B.
            </Text>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  </Collapsible>
);
