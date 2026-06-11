# User Scores API

Fetch the current moderation score for a specific user. Scores range from 1 (worst) to 5 (best) and reflect a user's ratio of penalty points to total submissions.

For details on how scores are calculated and what thresholds map to which score values, see [User Score](../user/concepts.md) in Basic Concepts.

## Endpoint

```http
GET /api/v1/user_scores
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Query parameters

| Parameter | Type   | Required? | Description                              |
| :-------- | :----- | :-------- | :--------------------------------------- |
| `id`      | String | Required  | Your unique identifier for the user      |
| `typeId`  | String | Required  | The Coop Item Type ID for this user type |

**Example request:**

```http
GET /api/v1/user_scores?id=user-123&typeId=your-user-type-id
```

## Response

Returns the user's score as a number between 1 and 5.

```json
3
```

HTTP statuses:

| Status            | Meaning                                        |
| :---------------- | :--------------------------------------------- |
| `200 OK`          | Score returned successfully                    |
| `400 Bad Request` | Missing or invalid `id` or `typeId` parameters |
| `401` or `403`    | Authentication failure                         |

See [Errors](errors.md) for the full error response format.
