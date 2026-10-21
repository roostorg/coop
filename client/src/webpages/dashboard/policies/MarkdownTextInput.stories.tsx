import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import MarkdownTextInput from './MarkdownTextInput';

const meta: Meta<typeof MarkdownTextInput> = {
  title: 'Policies/Rich text editor',
  component: MarkdownTextInput,
  parameters: { layout: 'padded' },
  args: {
    title: 'Policy Definition',
    textSize: 'small',
    text: '<h2>Harassment</h2><p>Do not post content that targets someone with <strong>repeated, unwanted contact</strong>.</p><ul><li><p>Threats or intimidation</p></li><li><p>Coordinated harassment</p></li></ul>',
  },
  render: function Editor(args) {
    const [text, setText] = useState(args.text);
    return (
      <div className="max-w-3xl mx-auto">
        <MarkdownTextInput {...args} text={text} setText={setText} />
      </div>
    );
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { text: '' } };
export const Disabled: Story = { args: { disabled: true } };
