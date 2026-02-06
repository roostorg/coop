import { Button } from '@/coop-ui/Button';
import { toast, Toast } from '@/coop-ui/Toast';
import { Meta } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/Toast',
  component: Toast,
  decorators: [
    (Story) => (
      <div>
        <Story />
        <Toast position="bottom-left" />
      </div>
    ),
  ],
} as Meta;

export const Description = () => (
  <Button
    onClick={() => {
      toast('This is a default toast!', {
        description: 'Some more context in the description!',
      });
    }}
  >
    Show Toast
  </Button>
);

export const Success = () => (
  <Button
    onClick={() => {
      toast.success('This is a success message!');
    }}
  >
    Show Success Toast
  </Button>
);

export const Info = () => (
  <Button
    onClick={() => {
      toast.info('This is an info message!');
    }}
  >
    Show Info Toast
  </Button>
);

export const Warning = () => (
  <Button
    onClick={() => {
      toast.warning('This is a warning message!');
    }}
  >
    Show Warning Toast
  </Button>
);

export const Error = () => (
  <Button
    onClick={() => {
      toast.error('This is an error message!');
    }}
  >
    Show Error Toast
  </Button>
);

export const Loading = () => (
  <Button
    onClick={() => {
      toast.loading('Loading...');
    }}
  >
    Show Loading Toast
  </Button>
);
