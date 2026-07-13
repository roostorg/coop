import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, jsonStringify, test } from '../fixtures/coop.js';
import { AUDIO_URL, IMAGE_URL } from '../fixtures/media.js';

// VIDEO is intentionally omitted — react-player/lazy (used by
// ManualReviewJobContentBlurableVideo) crashes in vite dev mode ("Element type
// is invalid: lazy element must resolve to a class or function"), taking down
// the whole page (no per-field error boundary). Re-add VIDEO once that is fixed.
const FIELDS: Field[] = [
  { name: 'text', type: ScalarTypes.STRING, required: true, container: null },
  { name: 'image', type: ScalarTypes.IMAGE, required: false, container: null },
  { name: 'audio', type: ScalarTypes.AUDIO, required: false, container: null },
];

test('an MRT job renders text/image/audio, plays audio, and records a decision', async ({
  page,
  request,
  deps,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  const itemType = await deps.ModerationConfigService.createContentType(
    admin.orgId,
    {
      name: `type-${uid()}`,
      schema: FIELDS as [Field, ...Field[]],
      schemaFieldRoles: {},
    },
  );
  const queue = await seed.createMrtQueue(admin);
  const actions = await deps.ModerationConfigService.getActions({
    orgId: admin.orgId,
  });
  const enqueueToMrt = actions.find((a) => a.actionType === 'ENQUEUE_TO_MRT');
  if (enqueueToMrt == null) {
    throw new Error('ENQUEUE_TO_MRT built-in action not found for org');
  }
  await seed.createRule(admin, itemType.id, {
    actionIds: [enqueueToMrt.id],
    conditionSet: {
      conjunction: 'AND',
      conditions: [
        {
          input: {
            type: 'CONTENT_FIELD',
            name: 'text',
            contentTypeId: itemType.id,
          },
          signal: {
            id: jsonStringify({ type: 'TEXT_MATCHING_CONTAINS_TEXT' }),
            type: 'TEXT_MATCHING_CONTAINS_TEXT',
          },
          matchingValues: { strings: ['test'] },
        },
      ],
    },
  });

  const uniqueText = `test media ${uid()}`;
  await seed.submitContentItem(request, admin, itemType.id, {
    text: uniqueText,
    image: IMAGE_URL,
    audio: AUDIO_URL,
  });
  await seed.waitForQueueDrained();

  await seed.login(page, admin);
  await page.goto(`/dashboard/manual_review/queues/review/${queue.id}`);
  await expect(page).toHaveURL(/\/review\/[^/]+\/[^/]+\/[^/]+/);
  const jobId = new URL(page.url()).pathname.split('/').at(-2)!;

  await expect(page.getByText('Text', { exact: true })).toBeVisible();
  await expect(page.getByText('Image', { exact: true })).toBeVisible();
  await expect(page.getByText('Audio', { exact: true })).toBeVisible();

  const audio = page.locator('audio').first();
  await expect(audio).toBeVisible();
  await audio.evaluate(async (el: HTMLAudioElement) => {
    // eslint-disable-next-line functional/immutable-data -- DOM elements are mutable by nature.
    el.muted = true;
    await el.play();
  });

  const submitResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/graphql') &&
      resp.request().postData()?.includes('submitManualReviewDecision') ===
        true,
  );
  await page
    .getByTestId('manual-review-decision-action-list')
    .getByText('Ignore', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await submitResponse;

  const res = await page.request.post('/api/v1/graphql', {
    data: {
      query: `query GetDecidedJobFromJobId($id: String!) {
  getDecidedJobFromJobId(id: $id) { decision { id } }
}`,
      variables: { id: jobId },
    },
  });
  const body = (await res.json()) as {
    data?: { getDecidedJobFromJobId?: { decision?: { id: string } } };
  };
  expect(body.data?.getDecidedJobFromJobId?.decision).not.toBeNull();
});
