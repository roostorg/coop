# OpenAI Moderation API

Use the [moderations endpoint](https://platform.openai.com/docs/guides/moderation) to check whether text or images are potentially harmful. If harmful content is identified, you can take corrective action, like filtering content or intervening with user accounts creating offending content. The moderation endpoint is free to use.

There are two models you can use:

- **omni-moderation-latest:** This model and all snapshots support more categorization options and multi-modal inputs.
- **text-moderation-latest (Legacy):** Older model that supports only text inputs and fewer input categorizations.

Here's a complete example showing how OpenAI is integrated into Coop.

## Signal Configuration

**Signal Class** - Each third-party signal extends the `SignalBase` class and implements the `run` method to call the external API.  
**Registration** - Signals are instantiated and registered in `server/services/signalsService/helpers/instantiateBuiltInSignals.ts`.

#### Rules Implementation

**Using the Signal in a Rule**:

```ts
{
  "name": "Block Hate Speech",
  "conditions": {
    "field": "post.text",
    "signal": {
      "type": "OPEN_AI_HATE_TEXT_MODEL"
    },
    "comparator": "GREATER_THAN",
    "threshold": 0.8
  },
  "actions": [
    { "type": "BLOCK" }
  ]
}
```

**Execution Flow** (`server/condition_evaluator/leafCondition.ts`):

```ts
// 1. Extract content field
const value = getFieldValue(content, condition.field); // "post.text"

// 2. Get signal implementation
const signal = signalsService.getSignal(condition.signal.type);

// 3. Run signal
const result = await signal.run({
  value: { type: 'STRING', value },
  orgId: org.id,
});

// 4. Compare to threshold
const conditionMet = result.score > condition.threshold; // 0.85 > 0.8 = true

// 5. Execute action if condition met
if (conditionMet) {
  await executeAction({ type: 'BLOCK' });
}
```
