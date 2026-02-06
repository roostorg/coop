import { Separator } from '@/coop-ui/Separator';
import { Heading, Text } from '@/coop-ui/Typography';
import { Meta } from '@storybook/react';

export default {
  title: 'Components/Separator',
  component: Separator,
} as Meta<typeof Separator>;

export const Default = () => (
  <div>
    <div className="space-y-1">
      <Heading as="h4" size="LG" weight="medium" className="leading-none">
        Radix Primitives
      </Heading>
      <Text size="SM" className="text-gray-600">
        An open-source UI component library.
      </Text>
    </div>
    <Separator className="my-4" />
    <div className="flex items-center h-5 text-sm space-x-4">
      <Text size="SM">Blog</Text>
      <Separator orientation="vertical" />
      <Text size="SM">Docs</Text>
      <Separator orientation="vertical" />
      <Text size="SM">Source</Text>
    </div>
  </div>
);
