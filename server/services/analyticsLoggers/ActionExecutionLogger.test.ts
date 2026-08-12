import { type Dependencies } from '../../iocContainer/index.js';
import { type ActionExecutionData } from '../../rule_engine/ActionPublisher.js';
import { type AnalyticsSchema } from '../../storage/dataWarehouse/IDataWarehouseAnalytics.js';
import { type CorrelationId } from '../../utils/correlationIds.js';
import { jsonParse, type JsonOf } from '../../utils/encoding.js';
import { ActionExecutionLogger } from './ActionExecutionLogger.js';

const asJsonOf = (s: string) => s as JsonOf<unknown>;

type BulkWrite = Dependencies['DataWarehouseAnalytics']['bulkWrite'];
// Same `as unknown as` pattern used in `test/setupMockedServer.ts` for the
// shared analytics mock — `jest.fn(async () => {})` returns a generic Mock
// that doesn't structurally satisfy the typed `bulkWrite` overload signature.
type BulkWriteMock = jest.MockedFunction<BulkWrite>;

function makeLogger() {
  const bulkWrite = jest.fn(async () => {}) as unknown as BulkWriteMock;
  const logger = new ActionExecutionLogger({ bulkWrite });
  return { logger, bulkWrite };
}

// `bulkWrite` is generic over `TableName`, so the recorded `rows` arg is a
// union across every analytics table. This logger only writes to
// ACTION_EXECUTIONS, so narrow once for the assertions.
function actionRows(
  bulkWrite: BulkWriteMock,
  callIndex = 0,
): readonly AnalyticsSchema['ACTION_EXECUTIONS'][] {
  const call = bulkWrite.mock.calls.at(callIndex);
  if (!call) throw new Error(`No bulkWrite call at index ${callIndex}`);
  return call[1] as readonly AnalyticsSchema['ACTION_EXECUTIONS'][];
}

const baseExecution: ActionExecutionData<CorrelationId<'manual-action-run'>> = {
  orgId: 'org-1',
  action: { id: 'action-1', name: 'Ban User' },
  targetItem: {
    itemId: 'item-1',
    itemType: { id: 'type-1', kind: 'CONTENT', name: 'Social Post' },
  },
  matchingRules: undefined,
  ruleEnvironment: undefined,
  correlationId: 'manual-action-run:abc' as CorrelationId<'manual-action-run'>,
  policies: [],
};

describe('ActionExecutionLogger', () => {
  it('JSON-stringifies parameterValues and writes actorNote straight through', async () => {
    const { logger, bulkWrite } = makeLogger();

    await logger.logActionExecutions({
      executions: [
        {
          ...baseExecution,
          parameterValues: { num_days: 7, reason: 'spam' },
          actorNote: 'Repeat offender',
        },
      ],
      failed: false,
    });

    expect(bulkWrite).toHaveBeenCalledTimes(1);
    expect(bulkWrite.mock.calls[0]?.[0]).toBe('ACTION_EXECUTIONS');
    const rows = actionRows(bulkWrite);
    expect(rows).toHaveLength(1);
    expect(jsonParse(asJsonOf(rows[0].parameters))).toEqual({
      num_days: 7,
      reason: 'spam',
    });
    expect(rows[0].actor_note).toBe('Repeat offender');
  });

  it("defaults parameters to '{}' and actor_note to undefined when both are absent", async () => {
    const { logger, bulkWrite } = makeLogger();

    await logger.logActionExecutions({
      executions: [baseExecution],
      failed: false,
    });

    const row = actionRows(bulkWrite)[0];
    // Mirrors the ClickHouse column's `DEFAULT '{}'` so readers always parse a JSON object.
    expect(row.parameters).toBe('{}');
    expect(jsonParse(asJsonOf(row.parameters))).toEqual({});
    expect(row.actor_note).toBeUndefined();
  });

  it('logs each execution as its own row, preserving per-execution params and notes', async () => {
    const { logger, bulkWrite } = makeLogger();

    await logger.logActionExecutions({
      executions: [
        {
          ...baseExecution,
          action: { id: 'action-a', name: 'A' },
          parameterValues: { x: 1 },
          actorNote: 'first',
        },
        {
          ...baseExecution,
          action: { id: 'action-b', name: 'B' },
          parameterValues: { y: 2 },
          actorNote: 'second',
        },
      ],
      failed: false,
    });

    const rows = actionRows(bulkWrite);
    expect(rows).toHaveLength(2);
    expect(jsonParse(asJsonOf(rows[0].parameters))).toEqual({ x: 1 });
    expect(rows[0].actor_note).toBe('first');
    expect(jsonParse(asJsonOf(rows[1].parameters))).toEqual({ y: 2 });
    expect(rows[1].actor_note).toBe('second');
  });
});
