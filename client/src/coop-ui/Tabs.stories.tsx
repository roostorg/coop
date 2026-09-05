import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/coop-ui/Tabs';
import { Text } from '@/coop-ui/Typography';
import { Meta } from '@storybook/react';

export default {
  title: 'Components/Tabs',
  component: Tabs,
} as Meta<typeof Tabs>;

export const Default = () => (
  <Tabs defaultValue="account" className="w-96">
    <TabsList>
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="password">Password</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
    </TabsList>
    <TabsContent value="account">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        Manage your account settings here.
      </Text>
    </TabsContent>
    <TabsContent value="password">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        Update your password here.
      </Text>
    </TabsContent>
    <TabsContent value="notifications">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        Configure notification preferences here.
      </Text>
    </TabsContent>
  </Tabs>
);

export const Disabled = () => (
  <Tabs defaultValue="account" className="w-96">
    <TabsList>
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="billing" disabled>
        Billing (disabled)
      </TabsTrigger>
    </TabsList>
    <TabsContent value="account">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        Manage your account settings here.
      </Text>
    </TabsContent>
    <TabsContent value="billing">
      <Text size="SM" className="text-gray-600 dark:text-neutral-400">
        Billing is disabled in this example.
      </Text>
    </TabsContent>
  </Tabs>
);
