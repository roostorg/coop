# GDPR Deletion API

Delete a user's personal data from Coop. Use this endpoint to fulfill GDPR "right to erasure" requests from EU residents whose data Coop has processed.

## Endpoint

```http
POST /api/v1/gdpr/delete
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Request

```json
{
  "userIds": [{ "id": "user-123", "typeId": "your-user-type-id" }]
}
```

You can include multiple users in a single request.

### Request body fields

| Field              | Type   | Required? | Description                                                              |
| :----------------- | :----- | :-------- | :----------------------------------------------------------------------- |
| `userIds`          | Array  | Required  | One or more users whose data should be deleted. Minimum 1 entry          |
| `userIds[].id`     | String | Required  | Your unique identifier for the user                                      |
| `userIds[].typeId` | String | Required  | The Coop Item Type ID for this user type, as configured in the dashboard |

## Response

Returns a unique ID for this deletion request, for your records.

```json
{
  "requestId": "deletion-request-uuid"
}
```

HTTP responses:

| Status            | Meaning                                        |
| :---------------- | :--------------------------------------------- |
| `201 Created`     | Deletion request accepted; returns `requestId` |
| `400 Bad Request` | Validation failure; see [Errors](errors.md)    |
| `401` or `403`    | Authentication failure                         |

Deletion is processed asynchronously. The `requestId` can be used to correlate this request with any downstream processing or audit logs.

See [Errors](errors.md) for the full error response format.

## Notes

- GDPR applies to any organization handling personal data of EU residents, regardless of where the organization is based.
- Deletion removes the user's data from Coop's systems; you are responsible for deletion from your own platform and any other processors you use.
