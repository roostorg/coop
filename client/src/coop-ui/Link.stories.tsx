import { Meta, StoryFn } from '@storybook/react';

import { Link } from './Link';
import { Heading, Text } from './Typography';

export default {
  title: 'Components/Link',
  component: Link,
  argTypes: {
    href: { control: 'text' },
    children: { control: 'text' },
  },
} as Meta<typeof Link>;

const Template: StoryFn<typeof Link> = (args) => <Link {...args} />;

export const Default = Template.bind({});
Default.args = {
  href: 'https://google.com',
  children: 'Visit google.com',
};

export const InLargeHeading = () => (
  <Heading as="h1" size="5XL">
    This is a large heading with a <Link href="https://example.com">link</Link>.
  </Heading>
);

export const InMediumHeading = () => (
  <Heading as="h2" size="4XL">
    This is a medium heading with a <Link href="https://example.com">link</Link>
    .
  </Heading>
);

export const InSmallHeading = () => (
  <Heading as="h3" size="3XL">
    This is a small heading with a <Link href="https://example.com">link</Link>.
  </Heading>
);

export const InExtraSmallHeading = () => (
  <Heading as="h4" size="2XL">
    This is an extra small heading with a{' '}
    <Link href="https://example.com">link</Link>.
  </Heading>
);

export const InParagraph = () => (
  <Text size="base">
    This is a paragraph with a <Link href="https://example.com">link</Link>{' '}
    inside it. You can see how the link interacts with the surrounding text,
    maintaining consistent styling.
  </Text>
);

export const InSmallText = () => (
  <Text size="SM">
    This is small text with a <Link href="https://example.com">link</Link>.
  </Text>
);

export const InMutedText = () => (
  <Text className="text-gray-600">
    This is muted text with a <Link href="https://example.com">link</Link>.
  </Text>
);

export const InQuote = () => (
  <blockquote className="border-l-4 border-gray-300 pl-4">
    <Text className="italic">
      This is a quote with a <Link href="https://example.com">link</Link>{' '}
      inside.
    </Text>
  </blockquote>
);
