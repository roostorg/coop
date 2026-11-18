import { uid } from 'uid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type NonEmptyString } from '../../utils/typescript-types.js';
import { type ConditionSet } from '../moderationConfigService/index.js';
import { buildSimplifiedHistoryQuery } from './reportingRuleHistoryHelpers.js';
import ReportingRules from './ReportingRules.js';

const conditionSet = {
  conjunction: 'AND',
  conditions: [],
} as unknown as ConditionSet;

describe('ReportingRules', () => {
  const testWithRules = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps, uid());
    const { user } = await createUser(deps.PrismaPg, org.id);
    const sut = new ReportingRules(deps.PrismaPg);
    const makeInput = (name = `rule-${uid()}`) => ({
      orgId: org.id,
      creatorId: user.id,
      name,
      description: '',
      status: 'LIVE' as const,
      itemTypeIds: ['item-type-1' as NonEmptyString] as [NonEmptyString],
      actionIds: ['action-1'],
      policyIds: ['policy-1'],
      conditionSet,
    });
    return { sut, orgId: org.id, deps, makeInput };
  });

  testWithRules(
    'creates a rule and reads it back with its joins and version',
    async ({ sut, orgId, makeInput }) => {
      const created = await sut.createReportingRule(makeInput());
      expect(created).toMatchObject({
        orgId,
        description: null,
        status: 'LIVE',
        conditionSet,
        itemTypeIds: ['item-type-1'],
        actionIds: ['action-1'],
        policyIds: ['policy-1'],
      });

      const rules = await sut.getReportingRules({ orgId });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({
        id: created.id,
        orgId,
        name: created.name,
        status: 'LIVE',
        conditionSet,
        itemTypeIds: ['item-type-1'],
        actionIds: ['action-1'],
        policyIds: ['policy-1'],
      });
      expect(rules[0].version).toBeDefined();
    },
  );

  testWithRules(
    'reports an empty policy list when the rule has no policies',
    async ({ sut, orgId, makeInput }) => {
      await sut.createReportingRule({ ...makeInput(), policyIds: [] });
      const [rule] = await sut.getReportingRules({ orgId });
      expect(rule.policyIds).toEqual([]);
    },
  );

  testWithRules(
    'updates fields and replaces join rows, keeping the ones not given',
    async ({ sut, orgId, makeInput }) => {
      const created = await sut.createReportingRule(makeInput());
      const updated = await sut.updateReportingRule({
        id: created.id,
        orgId,
        name: 'renamed',
        itemTypeIds: ['item-type-1', 'item-type-2'] as [
          NonEmptyString,
          NonEmptyString,
        ],
        policyIds: [],
      });
      expect(updated).toMatchObject({
        id: created.id,
        name: 'renamed',
        itemTypeIds: ['item-type-1', 'item-type-2'],
        actionIds: ['action-1'],
        policyIds: [],
      });
    },
  );

  testWithRules(
    'throws NotFoundError when updating another org’s rule or a missing one',
    async ({ sut, makeInput }) => {
      const created = await sut.createReportingRule(makeInput());
      await expect(
        sut.updateReportingRule({
          id: created.id,
          orgId: 'some-other-org',
          name: 'x',
        }),
      ).rejects.toMatchObject({ name: 'NotFoundError' });
      await expect(
        sut.updateReportingRule({ id: uid(), orgId: created.orgId, name: 'x' }),
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    },
  );

  testWithRules(
    'deletes only rules owned by the org',
    async ({ sut, orgId, makeInput }) => {
      const created = await sut.createReportingRule(makeInput());
      expect(
        await sut.deleteReportingRule({ id: created.id, orgId: 'other-org' }),
      ).toBe(false);
      expect(await sut.deleteReportingRule({ id: created.id, orgId })).toBe(
        true,
      );
      expect(await sut.deleteReportingRule({ id: created.id, orgId })).toBe(
        false,
      );
    },
  );

  testWithRules(
    'reads the simplified version history from the database',
    async ({ sut, deps, makeInput }) => {
      const created = await sut.createReportingRule(makeInput());
      const history = await buildSimplifiedHistoryQuery(
        deps.PrismaPg,
        ['name', 'status'],
        [created.id],
      ).execute();
      expect(history).toEqual([
        {
          id: created.id,
          name: created.name,
          status: 'LIVE',
          exactVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /),
        },
      ]);
    },
  );

  // reporting_rules_org_id_name_key is DEFERRABLE INITIALLY DEFERRED, so the
  // violation only surfaces at COMMIT. The transactional harness never
  // commits, so this test runs against real, committed transactions and
  // deletes its rows afterwards.
  describe('with committed transactions', () => {
    let prisma: Dependencies['PrismaPg'];
    const orgId = `reporting-rules-test-${uid()}`;

    beforeAll(async () => {
      prisma = (await getBottle()).container.PrismaPg;
    });

    afterAll(async () => {
      await prisma.reporting_rules.deleteMany({ where: { org_id: orgId } });
    });

    test('maps a duplicate name to ReportingRuleNameExistsError', async () => {
      const sut = new ReportingRules(prisma);
      const input = (name: string) => ({
        orgId,
        creatorId: 'creator',
        name,
        status: 'LIVE' as const,
        itemTypeIds: ['item-type-1' as NonEmptyString] as [NonEmptyString],
        actionIds: ['action-1'],
        policyIds: [],
        conditionSet,
      });

      await sut.createReportingRule(input('dupe'));
      await expect(
        sut.createReportingRule(input('dupe')),
      ).rejects.toMatchObject({ name: 'ReportingRuleNameExistsError' });

      const other = await sut.createReportingRule(input('other'));
      await expect(
        sut.updateReportingRule({ id: other.id, orgId, name: 'dupe' }),
      ).rejects.toMatchObject({ name: 'ReportingRuleNameExistsError' });
    });
  });
});
