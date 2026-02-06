import { Button, ButtonProps } from '@/coop-ui/Button';
import { Link as LinkComponent } from '@/coop-ui/Link';
import { Meta, StoryFn } from '@storybook/react';
import { Mail } from 'lucide-react';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'outline', 'ghost', 'soft', 'white', 'link'],
    },
    color: {
      control: { type: 'select' },
      options: ['gray', 'indigo', 'red', 'yellow', 'teal', 'white'],
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'lg', 'icon'],
    },
    asChild: { control: 'boolean' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
} as Meta<ButtonProps>;

const Template: StoryFn<ButtonProps> = (args) => <Button {...args} />;

export const Default = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">
        Indigo (Default)
      </span>
      <Button>Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray</span>
      <Button color="gray">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button color="red">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button color="yellow">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button color="teal">Button</Button>
    </div>
  </div>
);

export const Outline = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">
        Indigo (Default)
      </span>
      <Button variant="outline">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray</span>
      <Button variant="outline" color="gray">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button variant="outline" color="red">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button variant="outline" color="yellow">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button variant="outline" color="teal">
        Button
      </Button>
    </div>
  </div>
);

export const Ghost = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">
        Indigo (Default)
      </span>
      <Button variant="ghost">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray</span>
      <Button variant="ghost" color="gray">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button variant="ghost" color="red">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button variant="ghost" color="yellow">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button variant="ghost" color="teal">
        Button
      </Button>
    </div>
  </div>
);

export const Soft = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">
        Indigo (Default)
      </span>
      <Button variant="soft">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray</span>
      <Button variant="soft" color="gray">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button variant="soft" color="red">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button variant="soft" color="yellow">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button variant="soft" color="teal">
        Button
      </Button>
    </div>
  </div>
);

export const White = () => (
  <div className="flex flex-wrap gap-4 p-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray (Default)</span>
      <Button variant="white">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Indigo</span>
      <Button variant="white" color="indigo">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button variant="white" color="red">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button variant="white" color="yellow">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button variant="white" color="teal">
        Button
      </Button>
    </div>
  </div>
);

export const Link = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">
        Indigo (Default)
      </span>
      <Button variant="link">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Gray</span>
      <Button variant="link" color="gray">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Red</span>
      <Button variant="link" color="red">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Yellow</span>
      <Button variant="link" color="yellow">
        Button
      </Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Teal</span>
      <Button variant="link" color="teal">
        Button
      </Button>
    </div>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Small</span>
      <Button size="sm">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Default</span>
      <Button>Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Large</span>
      <Button size="lg">Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Icon</span>
      <Button size="icon">
        <Mail />
      </Button>
    </div>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap gap-4">
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Start Icon</span>
      <Button startIcon={Mail}>Button</Button>
    </div>
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">End Icon</span>
      <Button endIcon={Mail}>Button</Button>
    </div>
  </div>
);

export const Loading = Template.bind({});
Loading.args = {
  variant: 'default',
  color: 'indigo',
  size: 'default',
  loading: true,
  children: 'Loading...',
};

export const Disabled = Template.bind({});
Disabled.args = {
  variant: 'default',
  color: 'indigo',
  size: 'default',
  disabled: true,
  children: 'Disabled Button',
};

export const AsChild = Template.bind({});
AsChild.args = {
  variant: 'default',
  color: 'indigo',
  size: 'default',
  asChild: true,
  children: <LinkComponent href="/login">Button as Link</LinkComponent>,
};
