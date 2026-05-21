# Errors

Understand how Coop responds to API requests and errors.

## HTTP status codes

| Status                  | Meaning                                                                                                                                                   |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200 OK`                | Request succeeded; response body contains data                                                                                                            |
| `202 Accepted`          | Item submission received and queued for async processing                                                                                                  |
| `204 No Content`        | Request succeeded; no response body (e.g. report and appeal submissions)                                                                                  |
| `400 Bad Request`       | Invalid request: malformed JSON, missing required fields, or schema mismatch (e.g. a report referencing a non-existent item). See error body for details. |
| `401` or `403`          | Authentication failure: API key is missing, invalid, or expired                                                                                           |
| `429 Too Many Requests` | Rate limit exceeded                                                                                                                                       |
| `500` or `503`          | Internal server error. Typically transient; safe to retry                                                                                                 |
| `502` or `504`          | Gateway or dependency error: an upstream service is unavailable; retry                                                                                    |

## Error response format

All `4xx` errors return a JSON body in this format:

```json
{
  "errors": [
    {
      "status": 400,
      "type": ["/errors/invalid-user-input"],
      "title": "Short error description",
      "detail": "Detailed explanation of the problem (optional)",
      "pointer": "/path/to/problematic/field (optional)",
      "requestId": "correlation-id (optional)"
    }
  ]
}
```

| Field       | Description                                                    |
| :---------- | :------------------------------------------------------------- |
| `status`    | HTTP status code                                               |
| `type`      | Array of error type identifiers                                |
| `title`     | Short human-readable summary                                   |
| `detail`    | Additional context about the error, if available               |
| `pointer`   | JSON pointer to the field that caused the error, if applicable |
| `requestId` | Correlation ID for tracing                                     |
