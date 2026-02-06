import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { asyncIterableToArray } from '../../utils/collections.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type NormalizedItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import { type ItemInvestigationService } from './index.js';

describe('Item Investigation Service', () => {
  let container: Dependencies;
  let itemInvestigationService: ItemInvestigationService;

  beforeAll(async () => {
    // The mutation should be ok here since this is initial setup in a
    // beforeAll; it doesn't involve reset state for each test in the suite
    /* eslint-disable better-mutation/no-mutation */
    ({ container } = await getBottle());
    itemInvestigationService = container.ItemInvestigationService;
    /* eslint-enable better-mutation/no-mutation */
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
      { Org: container.Sequelize.Org },
      container.ModerationConfigService,
      container.ApiKeyService,
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
      { Org: container.Sequelize.Org },
      container.ModerationConfigService,
      container.ApiKeyService,
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
