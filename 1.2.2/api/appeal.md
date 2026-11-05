# Appeal API

Submit a user appeal to Coop. When a user contests a moderation decision on your platform, send the appeal here to create a review job in the Review Console.

For the full workflow—how appeals appear in the Review Console, uphold vs. overturn decisions—see [Appeals](../user/appeals.md). When a moderator makes a decision on an appeal, Coop sends the outcome to your platform via the [Appeal Decision Callback](actions.md#appeal-decision-callback).

## Endpoint

```http
POST /api/v1/report/appeal
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Request

```json
{
  "appealId": "platform-internal-appeal-id",
  "appealedBy": {
    "typeId": "appealer-user-type-id",
    "id": "appealer-user-id"
  },
  "appealedAt": "2024-01-15T12:00:00.000Z",
  "actionedItem": {
    "id": "item-that-was-actioned",
    "data": { "fieldName": "value" },
    "typeId": "item-type-id"
  },
  "actionsTaken": ["action-id-1", "action-id-2"],
  "appealReason": "User's explanation for why they are appealing",
  "violatingPolicies": [{ "id": "policy-id-1" }, { "id": "policy-id-2" }],
  "additionalItems": [
    { "id": "additional-context-item", "data": {}, "typeId": "item-type-id" }
  ]
}
```

### Request body fields

| Field               | Type            | Required? | Description                                                                                             |
| :------------------ | :-------------- | :-------- | :------------------------------------------------------------------------------------------------------ |
| `appealId`          | String          | Required  | Your internal ID for this appeal submission. Propagated back to you when a moderator reviews the appeal |
| `appealedBy`        | ItemIdentifier  | Required  | The user submitting the appeal. Include your internal user ID and the Coop Item Type ID for the user    |
| `appealedAt`        | Datetime        | Required  | [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) timestamp of when the appeal was submitted           |
| `actionedItem`      | Item            | Required  | The item that was originally actioned                                                                   |
| `actionsTaken`      | Array\<String\> | Required  | Coop IDs of the actions that were taken and sent to your Action callback                                |
| `appealReason`      | String          | Optional  | Free-form text from the user explaining why they're appealing                                           |
| `violatingPolicies` | Array\<Policy\> | Optional  | Policies received from the Action webhook when the initial moderation action was taken                  |
| `additionalItems`   | Array\<Item\>   | Optional  | Additional content to display alongside the appeal for context                                          |

## Response

| Status            | Meaning                                     |
| :---------------- | :------------------------------------------ |
| `204 No Content`  | Appeal received successfully                |
| `400 Bad Request` | Validation failure; see [Errors](errors.md) |
| `401` or `403`    | Authentication failure                      |

See [Errors](errors.md) for the full error response format.
