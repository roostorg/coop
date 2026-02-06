import { uid } from 'uid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import { type UserStrikeService } from './index.js';

describe('Item Investigation Service', () => {
  let container: Dependencies;
  let userStrikeService: UserStrikeService;

  beforeAll(async () => {
    // The mutation should be ok here since this is initial setup in a
    // beforeAll; it doesn't involve reset state for each test in the suite
    /* eslint-disable better-mutation/no-mutation */
    ({ container } = await getBottle());
    userStrikeService = container.UserStrikeService;
    /* eslint-enable better-mutation/no-mutation */
  });
  afterAll(async () => {
    await container.closeSharedResourcesForShutdown();
  });

  test('Should properly calculate strike counts for a given user', async () => {
    const fakeUserId = { id: uid(), typeId: uid() };
    const fakeOrgId = uid();
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId,
      'fakePolicyId',
      1,
    );
    const strikeCount1 = await userStrikeService.getUserStrikeValue(
      fakeOrgId,
      fakeUserId,
    );
    expect(strikeCount1).toEqual(1);
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId,
      'fakePolicyId1',
      1,
    );
    const strikeCount2 = await userStrikeService.getUserStrikeValue(
      fakeOrgId,
      fakeUserId,
    );
    expect(strikeCount2).toEqual(2);
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId,
      'fakePolicyId2',
      10,
    );
    const strikeCount3 = await userStrikeService.getUserStrikeValue(
      fakeOrgId,
      fakeUserId,
    );
    expect(strikeCount3).toEqual(12);
  });

  test('Should only apply strike for most severe policy violation', async () => {
    const testActions = [
      {
        orgId: 'fakeOrgId',
        action: {
          id: 'fakeActionId1',
          name: 'testAction1',
          applyUserStrikes: true,
          orgId: 'fakeOrgId',
          callbackUrl: 'fakeCallbackUrl1',
          callbackUrlHeaders: null,
          callbackUrlBody: null,
          customMrtApiParams: null,
          actionType: 'CUSTOM_ACTION' as const,
        },
        targetItem: { itemId: 'fakeItemId1', itemType: 'fakeItemType1' },
        matchingRules: undefined,
        ruleEnvironment: undefined,
        policies: [
          {
            id: 'fakePolicyId1',
            name: 'testPolicy1',
            userStrikeCount: 1,
            penalty: 'LOW' as const,
          },
          {
            id: 'severePolicyId',
            name: 'testPolicy2',
            userStrikeCount: 2,
            penalty: 'LOW' as const,
          },
        ],
      },
    ];
    const mostSeverePolicyViolation =
      userStrikeService.findMostSeverePolicyViolationFromActions(testActions);
    if (mostSeverePolicyViolation === undefined) {
      throw new Error('mostSeverePolicyViolation is undefined');
    }
    expect(mostSeverePolicyViolation.id).toEqual('severePolicyId');
  });
  test('findMostSeverePolicyViolationFromActions should return undefined if no actions apply user strikes', async () => {
    const testActions = [
      {
        orgId: 'fakeOrgId',
        action: {
          id: 'fakeActionId1',
          name: 'testAction1',
          applyUserStrikes: false,
          orgId: 'fakeOrgId',
          callbackUrl: 'fakeCallbackUrl1',
          callbackUrlHeaders: null,
          callbackUrlBody: null,
          customMrtApiParams: null,
          actionType: 'CUSTOM_ACTION' as const,
        },
        targetItem: { itemId: 'fakeItemId1', itemType: 'fakeItemType1' },
        matchingRules: undefined,
        ruleEnvironment: undefined,
        policies: [
          {
            id: 'fakePolicyId1',
            name: 'testPolicy1',
            userStrikeCount: 1,
            penalty: 'LOW' as const,
          },
          {
            id: 'severePolicyId',
            name: 'testPolicy2',
            userStrikeCount: 2,
            penalty: 'LOW' as const,
          },
        ],
      },
      {
        orgId: 'fakeOrgId',
        action: {
          id: 'fakeActionId1',
          name: 'testAction1',
          applyUserStrikes: false,
          orgId: 'fakeOrgId',
          callbackUrl: 'fakeCallbackUrl1',
          callbackUrlHeaders: null,
          callbackUrlBody: null,
          customMrtApiParams: null,
          actionType: 'CUSTOM_ACTION' as const,
        },
        targetItem: { itemId: 'fakeItemId1', itemType: 'fakeItemType1' },
        matchingRules: undefined,
        ruleEnvironment: undefined,
        policies: [
          {
            id: 'fakePolicyId1',
            name: 'testPolicy1',
            userStrikeCount: 1,
            penalty: 'LOW' as const,
          },
          {
            id: 'severePolicyId',
            name: 'testPolicy2',
            userStrikeCount: 2,
            penalty: 'LOW' as const,
          },
        ],
      },
    ];
    const mostSeverePolicyViolation =
      userStrikeService.findMostSeverePolicyViolationFromActions(testActions);
    expect(mostSeverePolicyViolation).toBeUndefined();
  });

  test('Should properly calculate strike values using getAllUserStrikeCountsForOrg', async () => {
    const fakeTypeId = uid();
    const fakeUserId1 = { id: uid(), typeId: fakeTypeId };
    const fakeUserId2 = { id: uid(), typeId: fakeTypeId };
    const fakeUserId3 = { id: uid(), typeId: fakeTypeId };
    const fakeOrgId = uid();
    // 1 strike for user 1
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId1,
      'fakePolicyId',
      1,
    );
    // 2 strikes for user 2
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId2,
      'fakePolicyId',
      1,
    );
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId2,
      'fakePolicyId1',
      1,
    );
    // 3 strikes for user 3
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId3,
      'fakePolicyId1',
      1,
    );
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId3,
      'fakePolicyId2',
      1,
    );
    await userStrikeService.applyUserStrike(
      fakeOrgId,
      fakeUserId3,
      'fakePolicyId3',
      1,
    );

    const userStrikesForOrg =
      await userStrikeService.getAllUserStrikeCountsForOrg(fakeOrgId);
    const user1 = userStrikesForOrg.find(
      (it) => it.user_identifier.id === fakeUserId1.id,
    );
    expect(user1?.strike_count).toEqual(1);
    const user2 = userStrikesForOrg.find(
      (it) => it.user_identifier.id === fakeUserId2.id,
    );
    expect(user2?.strike_count).toEqual(2);
    const user3 = userStrikesForOrg.find(
      (it) => it.user_identifier.id === fakeUserId3.id,
    );
    expect(user3?.strike_count).toEqual(3);
  });
});
