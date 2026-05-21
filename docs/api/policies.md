# Policies API

Fetch your organization's configured policies programmatically.

## Endpoint

```http
GET /api/v1/policies/
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Response

```json
{
  "policies": [
    { "id": "policy-id-1", "name": "Violence", "parentId": null },
    {
      "id": "policy-id-2",
      "name": "Graphic Violence",
      "parentId": "policy-id-1"
    },
    { "id": "policy-id-3", "name": "Threats", "parentId": "policy-id-1" },
    { "id": "policy-id-4", "name": "Spam", "parentId": null }
  ]
}
```

### Response fields

| Field                 | Type   | Description                                  |
| :-------------------- | :----- | :------------------------------------------- | ---------------------------------------------------------------- |
| `policies`            | Array  | All policies for your organization           |
| `policies[].id`       | String | Coop's unique, immutable ID for this policy  |
| `policies[].name`     | String | The display name you assigned to this policy |
| `policies[].parentId` | String | null                                         | ID of the parent policy, or `null` if this is a top-level policy |

## Notes

- Use `parentId` to reconstruct the full policy tree. A `null` `parentId` indicates a top-level policy; a non-null `parentId` links a sub-policy to its parent.

- Build integrations against policy `id` values, not `name` values. Names can be changed in the dashboard; IDs are immutable.

- For background on how policies are structured and used, see [Basic Concepts](../user/concepts.md#policy) and [Administration](../user/administration.md#policies).
