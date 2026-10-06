import { Button } from '@/coop-ui/Button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/coop-ui/Form';
import { Input } from '@/coop-ui/Input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta } from '@storybook/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export default {
  title: 'Components/Form',
  component: Form,
} as Meta<typeof Form>;

const schema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
});

export const Default = () => {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => undefined)}
        className="w-80 space-y-6"
      >
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="jane.doe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
};
