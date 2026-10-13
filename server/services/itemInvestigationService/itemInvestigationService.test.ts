import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import {
  itemIdentifierToScyllaItemIdentifier,
  ScyllaNilItemIdentifier,
} from '../../scylla/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { asyncIterableToArray } from '../../utils/collections.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringify } from '../../utils/encoding.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type NormalizedItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import { type ScyllaItemSubmissionsRow } from './dbTypes.js';
import { type ItemInvestigationService } from './index.js';

describe('Item Investigation Service', () => {
  let container: Dependencies;
  let itemInvestigationService: ItemInvestigationService;

  beforeAll(async () => {
    // The mutation should be ok here since this is initial setup in a
    // beforeAll; it doesn't involve reset state for each test in the suite

    ({ container } = await getBottle());
    itemInvestigationService = container.ItemInvestigationService;
  });
  afterAll(async () => {
    await container.closeSharedResourcesForShutdown();
  });

  // Testing both that we are properly inserting items and retrieving them from
  // the right tables, and that the scylla client is instantiated correctly
  // and can be called successfully
  test('should be able to call scylla client methods', async () => {
    const dummySchema = [
      {
        name: 'dummyField',
        type: 'STRING',
        required: false,
        container: null,
      },
    ] as const;
    const dummyOrgId = uid();

    await createOrg(
      {
        KyselyPg: container.KyselyPg,
        ModerationConfigService: container.ModerationConfigService,
        ApiKeyService: container.ApiKeyService,
      },
      dummyOrgId,
    );

    const savedItemType =
      await container.ModerationConfigService.createContentType(dummyOrgId, {
        schema: dummySchema,
        description: null,
        name: 'Content Item Type',
        schemaFieldRoles: {},
      });
    await itemInvestigationService.insertItem({
      orgId: dummyOrgId,
      requestId: toCorrelationId({ type: 'post-items', id: uuidv1() }),
      itemSubmission: {
        submissionId: 'dummyId' satisfies string as SubmissionId,
        submissionTime: new Date(),
        itemId: 'dummyItemId',
        creator: undefined,
        itemType: {
          id: savedItemType.id,
          orgId: 'dummyOrgId',
          kind: 'CONTENT',
          name: 'dummyItemTypeName',
          version: savedItemType.version,
          schemaVariant: 'original',
          description: 'dummyDescription',
          schema: [
            {
              name: 'dummyField',
              type: 'STRING',
              required: false,
              container: null,
            },
          ],
          schemaFieldRoles: {},
        },
        data: instantiateOpaqueType<NormalizedItemData>({}),
      },
    });
    const item = await itemInvestigationService.getItemByIdentifier({
      orgId: dummyOrgId,
      itemIdentifier: {
        id: 'dummyItemId',
        typeId: savedItemType.id,
      },
    });
    expect(item?.latestSubmission.submissionId).toEqual('dummyId');
  });

  test.each([true, false])(
    'isolates Scylla item lookups by org (latestSubmissionOnly=%s)',
    async (latestSubmissionOnly) => {
      const orgA = await createOrg(container);
      const orgB = await createOrg(container);
      const orgWithoutItem = await createOrg(container);
      const itemType =
        await container.ModerationConfigService.createContentType(orgA.org.id, {
          name: 'Message',
          description: null,
          schema: [
            {
              name: 'content',
              type: 'STRING',
              required: false,
              container: null,
            },
          ],
          schemaFieldRoles: {},
        });
      const itemIdentifier = { id: uid(), typeId: itemType.id };
      const now = Date.now();
      const submissions = [
        { orgId: orgB.org.id, content: 'foreign-newest', time: now },
        { orgId: orgA.org.id, content: 'own-latest', time: now - 1000 },
        { orgId: orgB.org.id, content: 'foreign-oldest', time: now - 3000 },
        { orgId: orgA.org.id, content: 'own-prior', time: now - 2000 },
      ];

      try {
        // Seed the real global index with an identifier shared across orgs.
        // Explicit timestamps avoid ties and ensure foreign rows would appear
        // in both latest and prior submissions without the org filter.
        for (const { orgId, content, time } of submissions) {
          await container.Scylla.insert({
            into: 'item_submission_by_thread',
            row: {
              org_id: orgId,
              request_id: null,
              submission_id: uuidv1() as SubmissionId,
              item_identifier:
                itemIdentifierToScyllaItemIdentifier(itemIdentifier),
              item_type_name: itemType.name,
              item_type_version: itemType.version,
              item_creator_identifier: ScyllaNilItemIdentifier,
              item_data: jsonStringify(
                instantiateOpaqueType<NormalizedItemData>({ content }),
              ),
              item_submission_time: new Date(time),
              item_synthetic_created_at: new Date(now),
              synthetic_thread_id: itemIdentifier.id,
              parent_identifier: ScyllaNilItemIdentifier,
              thread_identifier: ScyllaNilItemIdentifier,
              item_type_schema_field_roles: jsonStringify(
                itemType.schemaFieldRoles,
              ),
              item_type_schema: jsonStringify(itemType.schema),
              item_type_schema_variant: 'original',
              item_ip_address: null,
            } satisfies ScyllaItemSubmissionsRow,
            ttlInSeconds: 60,
          });
        }

        const result = await itemInvestigationService.getItemByIdentifier({
          orgId: orgA.org.id,
          itemIdentifier,
          latestSubmissionOnly,
        });
        expect(result?.latestSubmission.data).toEqual({
          content: 'own-latest',
        });
        expect(
          result?.priorSubmissions?.map((submission) => submission.data),
        ).toEqual(
          latestSubmissionOnly ? undefined : [{ content: 'own-prior' }],
        );

        // All Scylla rows are foreign to this org. Exercise the real fallback
        // services too: no partial endpoint or warehouse records are configured.
        await expect(
          itemInvestigationService.getItemByIdentifier({
            orgId: orgWithoutItem.org.id,
            itemIdentifier,
            latestSubmissionOnly,
          }),
        ).resolves.toBeNull();
      } finally {
        await orgA.cleanup();
        await orgB.cleanup();
        await orgWithoutItem.cleanup();
      }
    },
  );

  test('ParentStream query should return the correct items', async () => {
    const dummySchema = [
      {
        name: 'parent',
        type: 'RELATED_ITEM',
        required: false,
        container: null,
      },
      {
        name: 'thread',
        type: 'RELATED_ITEM',
        required: true,
        container: null,
      },
      {
        name: 'content',
        type: 'STRING',
        required: false,
        container: null,
      },
      {
        name: 'time',
        type: 'DATETIME',
        required: true,
        container: null,
      },
    ] as const;
    const dummyOrgId = uid();

    await createOrg(
      {
        KyselyPg: container.KyselyPg,
        ModerationConfigService: container.ModerationConfigService,
        ApiKeyService: container.ApiKeyService,
      },
      dummyOrgId,
    );

    const savedItemType =
      await container.ModerationConfigService.createContentType(dummyOrgId, {
        schema: dummySchema,
        description: null,
        name: 'Content Item Type',
        schemaFieldRoles: {
          parentId: 'parent',
          threadId: 'thread',
          createdAt: 'time',
        },
      });

    const grandparent = {
      id: 'dummyGrandparentId',
      data: instantiateOpaqueType<NormalizedItemData>({
        content: 'Im the grandparent',
        thread: {
          id: 'testThread',
          typeId: 'testThreadType',
        },
        time: Date.now(),
      }),
    };
    const parent = {
      id: 'dummyParentId',
      data: instantiateOpaqueType<NormalizedItemData>({
        content: 'Im the parent',
        time: Date.now(),
        thread: {
          id: 'testThread',
          typeId: 'testThreadType',
        },
        parent: {
          id: grandparent.id,
          typeId: savedItemType.id,
        },
      }),
    };
    const child = {
      id: 'dummyChildId',
      data: instantiateOpaqueType<NormalizedItemData>({
        content: 'Im the child',
        time: Date.now(),
        thread: {
          id: 'testThread',
          typeId: 'testThreadType',
        },
        parent: {
          id: parent.id,
          typeId: savedItemType.id,
        },
      }),
    };
    await Promise.all([
      itemInvestigationService.insertItem({
        orgId: dummyOrgId,
        requestId: toCorrelationId({ type: 'post-items', id: uuidv1() }),
        itemSubmission: {
          submissionId: uuidv1() satisfies string as SubmissionId,
          submissionTime: new Date(),
          itemId: grandparent.id,
          creator: undefined,
          itemType: savedItemType,
          data: grandparent.data,
        },
      }),
      itemInvestigationService.insertItem({
        orgId: dummyOrgId,
        requestId: toCorrelationId({ type: 'post-items', id: uuidv1() }),
        itemSubmission: {
          submissionId: uuidv1() satisfies string as SubmissionId,
          submissionTime: new Date(),
          itemId: parent.id,
          creator: undefined,
          itemType: savedItemType,
          data: parent.data,
        },
      }),
      itemInvestigationService.insertItem({
        orgId: dummyOrgId,
        requestId: toCorrelationId({ type: 'post-items', id: uuidv1() }),
        itemSubmission: {
          submissionId: uuidv1() satisfies string as SubmissionId,
          submissionTime: new Date(),
          itemId: child.id,
          creator: undefined,
          itemType: savedItemType,
          data: child.data,
        },
      }),
    ]);
    const ancestors = await asyncIterableToArray(
      itemInvestigationService.getAncestorItems({
        orgId: dummyOrgId,
        itemIdentifier: {
          id: child.id,
          typeId: savedItemType.id,
        },
        numParentLevels: 2,
      }),
    );
    expect(ancestors.length).toEqual(2);
    expect(ancestors[0].latestSubmission.itemId).toEqual(parent.id);
    expect(ancestors[1].latestSubmission.itemId).toEqual(grandparent.id);
  });
});
