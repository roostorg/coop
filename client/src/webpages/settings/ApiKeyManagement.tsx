import { Button } from '@/coop-ui/Button';
import { Checkbox } from '@/coop-ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/coop-ui/Dialog';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Text } from '@/coop-ui/Typography';
import {
  useGQLApiKeysQuery,
  useGQLCreateApiKeyMutation,
  useGQLDeleteApiKeyMutation,
  useGQLRotateApiKeyMutation,
  useGQLUpdateApiKeyMutation,
  type GQLApiKeysQuery,
} from '@/graphql/generated';
import { useState } from 'react';

type Key = GQLApiKeysQuery['apiKeys'][number];

export default function ApiKeyManagement() {
  const { data, loading, error, refetch } = useGQLApiKeysQuery();
  const [createKey] = useGQLCreateApiKeyMutation();
  const [rotateKey] = useGQLRotateApiKeyMutation();
  const [deleteKey] = useGQLDeleteApiKeyMutation();
  const [updateKey] = useGQLUpdateApiKeyMutation();
  const [dialog, setDialog] = useState<
    | { action: 'create' }
    | { action: 'edit' | 'rotate' | 'delete'; key: Key }
    | null
  >(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    setMutationError(null);
    try {
      if (dialog.action === 'create') {
        const result = await createKey({
          variables: {
            input: {
              name: name.trim(),
              description: description.trim() || null,
              permissions,
            },
          },
        });
        if (!result.data) throw new Error('Failed to create API key');
        setSecret(result.data.createApiKey.apiKey);
      } else if (dialog.action === 'edit') {
        const result = await updateKey({
          variables: {
            input: {
              id: dialog.key.id,
              name: name.trim(),
              description: description.trim() || null,
            },
          },
        });
        if (!result.data?.updateApiKey) throw new Error('API key not found');
      } else if (dialog.action === 'rotate') {
        const result = await rotateKey({
          variables: {
            input: {
              id: dialog.key.id,
              name: dialog.key.name,
              description: dialog.key.description,
            },
          },
        });
        const response = result.data?.rotateApiKey;
        if (response?.__typename !== 'RotateApiKeySuccessResponse') {
          throw new Error(response?.detail ?? 'Failed to rotate API key');
        }
        setSecret(response.apiKey);
      } else {
        const result = await deleteKey({ variables: { id: dialog.key.id } });
        if (!result.data?.deleteApiKey) throw new Error('API key not found');
      }
      setCopied(false);
      setDialog(null);
      await refetch();
    } catch (err) {
      setMutationError(
        err instanceof Error ? err.message : 'Failed to update API key',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="flex flex-col gap-4 mb-8"
      aria-label="API key management"
    >
      <div className="flex flex-wrap justify-between items-center gap-4">
        <Text size="SM">
          Use a separate named key for each integration. Send it in the
          x-api-key request header.
        </Text>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            setName('');
            setDescription('');
            setPermissions([]);
            setMutationError(null);
            setSecret(null);
            setDialog({ action: 'create' });
          }}
        >
          Create key
        </Button>
      </div>
      {loading && <Text size="SM">Loading API keys…</Text>}
      {error && (
        <div role="alert">
          <Text size="SM">Unable to load API keys.</Text>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && data?.apiKeys.length === 0 && (
        <Text size="SM">
          No API keys. Create a key to connect an integration.
        </Text>
      )}
      {mutationError && !dialog && (
        <Text role="alert" className="text-red-700">
          {mutationError}
        </Text>
      )}
      {secret && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col gap-3"
          role="status"
        >
          <Text size="SM">
            Copy this API key now. You cannot retrieve it after leaving this
            page.
          </Text>
          <Input
            aria-label="New API key"
            value={secret}
            readOnly
            className="font-mono"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setCopied(true);
                } catch {
                  setMutationError(
                    'Unable to copy. Select and copy the key manually.',
                  );
                }
              }}
            >
              {copied ? 'Copied' : 'Copy key'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSecret(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      {data?.apiKeys.map((key) => (
        <div
          key={key.id}
          className="rounded-lg border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="min-w-0 break-words">
            <Text className="font-semibold">{key.name}</Text>
            {key.description && <Text size="SM">{key.description}</Text>}
            {key.permissions.length ? (
              <ul
                aria-label={`Permissions for ${key.name}`}
                className="flex flex-wrap gap-x-3 gap-y-1 my-2 text-sm"
              >
                {key.permissions.map((permission) => (
                  <li key={permission} className="font-mono">
                    {permission}
                  </li>
                ))}
              </ul>
            ) : (
              <Text size="SM">No permissions</Text>
            )}
            <Text size="SM" className="text-gray-500">
              Created {new Date(key.createdAt).toLocaleDateString()} · Last used{' '}
              {key.lastUsedAt
                ? new Date(key.lastUsedAt).toLocaleDateString()
                : 'Never'}
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={`Edit ${key.name}`}
              onClick={() => {
                setName(key.name);
                setDescription(key.description ?? '');
                setMutationError(null);
                setSecret(null);
                setDialog({ action: 'edit', key });
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Rotate ${key.name}`}
              onClick={() => {
                setMutationError(null);
                setSecret(null);
                setDialog({ action: 'rotate', key });
              }}
            >
              Rotate
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Delete ${key.name}`}
              onClick={() => {
                setMutationError(null);
                setSecret(null);
                setDialog({ action: 'delete', key });
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="m-0 w-[calc(100%_-_2rem)] max-w-lg max-h-[calc(100dvh_-_2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'create'
                ? 'Create API key'
                : dialog?.action === 'edit'
                  ? 'Edit API key'
                  : dialog?.action === 'rotate'
                    ? 'Rotate API key'
                    : 'Delete API key'}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {dialog?.action === 'create'
              ? 'Name this key for the integration that will use it. Existing keys will keep working.'
              : dialog?.action === 'edit'
                ? 'Update the name and description. The API key itself will not change, and applications will keep working.'
                : dialog?.action === 'rotate'
                  ? `Replace the secret for “${dialog.key.name}”. Its current secret will stop working immediately. Permissions stay the same. Other keys are not affected.`
                  : dialog &&
                    `Permanently delete “${dialog.key.name}”. Applications using it will lose access immediately. Other keys are not affected.`}
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {(dialog?.action === 'create' || dialog?.action === 'edit') && (
              <div className="px-4 flex flex-col gap-3">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={255}
                  required
                  disabled={busy}
                />
                <Label htmlFor="api-key-description">
                  Description (optional)
                </Label>
                <Input
                  id="api-key-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={busy}
                />
                {dialog.action === 'create' && (
                  <fieldset
                    disabled={busy}
                    className="min-w-0 flex flex-col gap-3"
                  >
                    <legend className="mb-2 text-sm font-semibold">
                      Permissions
                    </legend>
                    <Text size="SM">
                      Select only what this integration needs. Permissions are
                      independent: write does not include read. No permissions
                      are selected by default. To change permissions later,
                      delete this key and create a new one.
                    </Text>
                    {data?.apiKeyPermissions.map(({ value, description }) => (
                      <div key={value} className="flex items-start gap-3">
                        <Checkbox
                          id={`api-key-${value}`}
                          className="mt-1"
                          checked={permissions.includes(value)}
                          disabled={busy}
                          aria-describedby={`api-key-${value}-description`}
                          onCheckedChange={(checked) =>
                            setPermissions((current) =>
                              checked
                                ? [...current, value]
                                : current.filter(
                                    (permission) => permission !== value,
                                  ),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <Label
                            htmlFor={`api-key-${value}`}
                            className="font-mono"
                          >
                            {value}
                          </Label>
                          <Text id={`api-key-${value}-description`} size="SM">
                            {description}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
            {mutationError && (
              <div role="alert" className="px-4 text-red-700">
                {mutationError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={
                  busy ||
                  ((dialog?.action === 'create' || dialog?.action === 'edit') &&
                    !name.trim())
                }
              >
                {busy
                  ? 'Saving…'
                  : dialog?.action === 'create'
                    ? 'Create key'
                    : dialog?.action === 'edit'
                      ? 'Save changes'
                      : dialog?.action === 'rotate'
                        ? 'Rotate key'
                        : 'Delete key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
