# Submit Items API

Send [Items](../user/concepts.md#item) to Coop for automated rule evaluation. Every time you submit an item, Coop runs it through all your configured [Proactive Rules](../user/rules.md#proactive-rules).

Submit items when they are created, edited, reported, or otherwise need to be re-evaluated. You should also submit items retroactively if you configure new rules after launch. To support Coop fetching Items and their attributes on demand, see the [Partial Items API](../api/partial-items.md).

## Endpoint

```http
POST /api/v1/items/async/
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Request

```json
{
  "items": [
    {
      "id": "unique-item-id-123",
      "typeId": "your-item-type-id",
      "data": {
        "fieldName1": "value1",
        "fieldName2": 123
      }
    }
  ]
}
```

You can submit multiple items in a single request by including additional objects in the `items` array. All processing is asynchronous.

### Request body fields

| Field                       | Type   | Required? | Description                                                                           |
| :-------------------------- | :----- | :-------- | :------------------------------------------------------------------------------------ |
| `items`                     | Array  | Required  | One or more items to submit                                                           |
| `items[].id`                | String | Required  | Your unique identifier for this item                                                  |
| `items[].typeId`            | String | Required  | The Coop Item Type ID for this item, as configured in the dashboard                   |
| `items[].data`              | Object | Required  | The item payload. Fields must match the schema defined for the Item Type              |
| `items[].data.images`       | Array  | Optional  | Array of URL strings. Triggers automated [HMA image hashing](../integrations/hma.md). |
| `items[].typeVersion`       | String | Optional  | Version string for schema versioning                                                  |
| `items[].typeSchemaVariant` | String | Optional  | Schema variant. Valid values: `"original"` or `"partial"`                             |

### Formatting `data` fields

The shape of `data` must match your Item Type's schema. Common field types:

| Field type            | Format                                              |
| :-------------------- | :-------------------------------------------------- |
| String                | Plain string value                                  |
| Number                | JSON number                                         |
| Boolean               | `true` or `false`                                   |
| Image / Audio / Video | URL string pointing to the media                    |
| Geohash               | Base-32 geohash string                              |
| Datetime              | ISO 8601 string (e.g. `"2024-01-15T10:30:00.000Z"`) |
| Related Item          | `{ "id": "...", "typeId": "..." }` object           |

### Media access

All media fields (image, audio, video) are submitted as URL references. Coop does not upload or store media content directly.

When an item is submitted, Coop fetches each media URL at that time to run signal processing (HMA hashing, Content Safety analysis, etc.). Media is not re-fetched when a moderator opens the job; instead, the browser loads it directly from the original URL at review time.

Fetches are unauthenticated GET requests. Coop does not forward your API key or any credential to the media URL.

For private or access-controlled media, use pre-signed URLs (e.g. S3 pre-signed URLs). Because the browser loads media directly at review time—potentially hours or days after submission—pre-signed URLs must remain valid for the entire window during which a job could sit in a queue, not just long enough for submission-time signal processing.

## Response

| Status            | Meaning                                       |
| :---------------- | :-------------------------------------------- |
| `202 Accepted`    | Items received and queued for rule evaluation |
| `400 Bad Request` | Validation failure; see [Errors](errors.md)   |
| `401` or `403`    | Authentication failure                        |

See [Errors](errors.md) for the full error response format.

## Automated Image Hashing

If the `data` object for an item contains an `images` field consisting of an array of URL strings, Coop will automatically:

1. Fetch the image content from the provided URLs.
2. Compute perceptual hashes for each image.
3. Check these hashes against all [HMA Matching Banks](../integrations/hma.md) configured for your organization.
4. Add the resulting HMA signals to the item for evaluation against your [Automated Rules](../user/rules.md).

## Notes

- **Asynchronous Processing**: This endpoint is designed for high-volume asynchronous processing. Submissions are enqueued in Redis (via BullMQ) and processed by background workers.

- **Immediate Results**: If your implementation strictly requires synchronous processing (receiving rule results in the same HTTP response), use the legacy `POST /api/v1/content/` endpoint. Note that the legacy endpoint does not support batched submissions or automated HMA image hashing.

- **Action Callbacks**: If a rule matches and triggers an action, Coop sends a POST request to your [action callback endpoint](actions.md).

- **Basic Concepts**: For background on Item Types and how items are identified in Coop, see [Basic Concepts](../user/concepts.md).
