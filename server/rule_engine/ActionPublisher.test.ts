/**
 * Unit tests for ActionPublisher to verify action execution logging behavior.
 *
 * This test file specifically verifies the fix for the double-logging bug where
 * N triggered actions would result in N² log entries due to logging all actions
 * on each iteration instead of just the current one.
 */

import getBottle, { type Dependencies } from "../iocContainer/index.js";
import { ActionType } from "../services/moderationConfigService/index.js";
import { type CorrelationId } from "../utils/correlationIds.js";
import { type ActionPublisher } from "./ActionPublisher.js";
import { RuleEnvironment } from "./RuleEngine.js";

describe("ActionPublisher", () => {
	let container: Dependencies;
	let actionPublisher: ActionPublisher;

	beforeAll(async () => {
		/* eslint-disable better-mutation/no-mutation */
		({ container } = await getBottle());
		actionPublisher = container.ActionPublisher;
		/* eslint-enable better-mutation/no-mutation */
	});

	afterAll(async () => {
		await container.closeSharedResourcesForShutdown();
	});

	describe("publishActions", () => {
		it("should log each action execution exactly once (not N² times)", async () => {
			const logSpy = jest.spyOn(
				container.ActionExecutionLogger,
				"logActionExecutions",
			);

			// Use 2 actions to catch the N² bug
			// With the bug: 2 actions → 2² = 4 log entries
			// With the fix: 2 actions → 2 log entries
			const triggeredActions = [
				{
					action: {
						id: "action-1",
						orgId: "org-123",
						name: "Action 1",
						applyUserStrikes: false,
						actionType: ActionType.CUSTOM_ACTION,
						callbackUrl: "https://example.com/action1",
						callbackUrlHeaders: null,
						callbackUrlBody: null,
						customMrtApiParams: null,
					},
					policies: [
						{
							id: "policy-1",
							name: "Policy 1",
							penalty: "NONE" as const,
							userStrikeCount: 0,
						},
					],
					matchingRules: [
						{
							id: "rule-1",
							name: "Rule 1",
							version: "1",
							tags: [],
							policies: [],
						},
					],
					ruleEnvironment: RuleEnvironment.LIVE,
				},
				{
					action: {
						id: "action-2",
						orgId: "org-123",
						name: "Action 2",
						applyUserStrikes: false,
						actionType: ActionType.CUSTOM_ACTION,
						callbackUrl: "https://example.com/action2",
						callbackUrlHeaders: null,
						callbackUrlBody: null,
						customMrtApiParams: null,
					},
					policies: [
						{
							id: "policy-2",
							name: "Policy 2",
							penalty: "NONE" as const,
							userStrikeCount: 0,
						},
					],
					matchingRules: [
						{
							id: "rule-2",
							name: "Rule 2",
							version: "1",
							tags: [],
							policies: [],
						},
					],
					ruleEnvironment: RuleEnvironment.LIVE,
				},
			];

			const executionContext = {
				orgId: "org-123",
				correlationId: "post-content:abc123" as CorrelationId<"post-content">,
				targetItem: {
					itemId: "item-123",
					itemType: { id: "type-123", kind: "CONTENT" as const },
				},
			};

			await actionPublisher.publishActions(triggeredActions, executionContext);

			// With the fix: called 2 times (once per action)
			expect(logSpy).toHaveBeenCalledTimes(2);

			// Each call should log exactly one execution
			logSpy.mock.calls.forEach((call) => {
				expect(call[0].executions).toHaveLength(1);
			});

			logSpy.mockRestore();
		});
	});
});
