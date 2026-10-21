# Report API

Submit a user report to Coop. When your platform receives a user flag, send it here to create a moderation job in the Review Console.

For the full workflow—what Coop does with a report, routing rules, NCMEC handling—see [Reports](../user/reports.md).

## Endpoint

```http
POST /api/v1/report
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Request

```json
{
  "reporter": {
    "kind": "user",
    "typeId": "reporter-user-type-id",
    "id": "reporter-user-id"
  },
  "reportedAt": "2024-01-15T10:30:00.000Z",
  "reportedForReason": {
    "policyId": "violated-policy-id",
    "reason": "Free-text reason from reporter",
    "csam": false
  },
  "reportedItem": {
    "id": "reported-item-id",
    "data": { "fieldName": "value" },
    "typeId": "item-type-id"
  },
  "reportedItemThread": [
    {
      "id": "thread-message-1",
      "data": { "content": "message content" },
      "typeId": "message-type-id"
    }
  ],
  "reportedItemsInThread": [
    { "id": "specific-reported-message", "typeId": "message-type-id" }
  ],
  "additionalItems": [
    { "id": "additional-context-item", "data": {}, "typeId": "item-type-id" }
  ]
}
```

### Request body fields

| Field                      | Type                    | Required? | Description                                                                                                              |
| :------------------------- | :---------------------- | :-------- | :----------------------------------------------------------------------------------------------------------------------- |
| `reporter`                 | Reporter                | Required  | The user that submitted the report                                                                                       |
| `reportedAt`               | Datetime                | Required  | [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) timestamp of when the item was reported                               |
| `reportedItem`             | ReportedItem            | Required  | The item that was reported                                                                                               |
| `reportedItem.data.images` | Array                   | Optional  | Array of URL strings. Triggers automated [HMA image hashing](../integrations/hma.md).                                    |
| `reportedForReason`        | ReportedForReason       | Optional  | Why the item was reported                                                                                                |
| `reportedItemThread`       | Array\<ReportedItem\>   | Optional  | Other items in the same thread (e.g. surrounding messages in a DM thread). Coop uses this to show reviewers full context |
| `reportedItemsInThread`    | Array\<ItemIdentifier\> | Optional  | Items within `reportedItemThread` that were specifically reported (tagged in the review UI)                              |
| `additionalItems`          | Array\<ReportedItem\>   | Optional  | Other content to display alongside the report for context (e.g. the author's recent posts)                               |

**Reporter schema:**

| Field    | Type   | Required? | Description                                                                       |
| :------- | :----- | :-------- | :-------------------------------------------------------------------------------- |
| `kind`   | String | Required  | Type of reporting entity. Currently only `"user"` is supported                    |
| `id`     | String | Required  | Your unique identifier for the reporting user                                     |
| `typeId` | String | Required  | The Item Type ID of the reporting user, as configured in the Item Types Dashboard |

**ReportedItem schema:**

| Field    | Type   | Required? | Description                                                            |
| :------- | :----- | :-------- | :--------------------------------------------------------------------- |
| `id`     | String | Required  | Your unique identifier for the reported item                           |
| `typeId` | String | Required  | The Item Type ID for the reported item                                 |
| `data`   | JSON   | Required  | The item payload. Must conform to the schema defined for the item type |

`reportedItemThread` uses the same schema as `ReportedItem`, but does not strictly enforce required fields to allow retroactive fetching. Include a `datetime` field on thread items to ensure correct chronological ordering.

**ItemIdentifier schema:**

| Field    | Type   | Required? | Description                         |
| :------- | :----- | :-------- | :---------------------------------- |
| `id`     | String | Required  | Your unique identifier for the item |
| `typeId` | String | Required  | The Item Type ID for the item       |

**ReportedForReason schema:**

| Field      | Type    | Required? | Description                                                                                      |
| :--------- | :------ | :-------- | :----------------------------------------------------------------------------------------------- |
| `policyId` | String  | Optional  | The ID of the policy being violated, if the reporter selected a reason that maps to a policy     |
| `reason`   | String  | Optional  | Freeform text from the reporter explaining why they submitted the report                         |
| `csam`     | Boolean | Optional  | When `true`, Coop routes the job directly to the NCMEC queue instead of the default review queue |

## Response

Returns a unique Coop-assigned ID for the report on success.

```json
{ "reportId": "report-uuid" }
```

| Field      | Type   | Description                                   |
| :--------- | :----- | :-------------------------------------------- |
| `reportId` | String | A unique ID for this report, assigned by Coop |

HTTP statuses:

| Status            | Meaning                                     |
| :---------------- | :------------------------------------------ |
| `201 Created`     | Report received; returns a `reportId`       |
| `400 Bad Request` | Validation failure; see [Errors](errors.md) |
| `401` or `403`    | Authentication failure                      |

See [Errors](errors.md) for the full error response format.
