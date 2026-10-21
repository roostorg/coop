# Policies API

Fetch your organization's configured policies programmatically.

## Create and update

```http
POST /api/v1/policies/
PATCH /api/v1/policies/policy-id
```

```json
{ "name": "Spam", "policyText": "No unsolicited advertising" }
```

Create requires `name` and returns `201`. PATCH accepts only supplied fields
and returns `200`; use `null` to clear nullable fields such as `parentId`.
Responses use the same public policy shape documented below.

## Endpoint

```http
GET /api/v1/policies/
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Response

```json
{
  "policies": [
    {
      "id": "policy-id-1",
      "name": "Violence",
      "parentId": null,
      "policyText": "Do not post graphic violence.",
      "enforcementGuidelines": null,
      "policyType": "VIOLENCE",
      "semanticVersion": 1,
      "userStrikeCount": 1,
      "applyUserStrikeCountConfigToChildren": false,
      "penalty": "NONE"
    }
  ]
}
```

### Response fields

| Field                                             | Type           | Description                                             |
| :------------------------------------------------ | :------------- | :------------------------------------------------------ |
| `policies`                                        | Array          | All policies for your organization                      |
| `policies[].id`                                   | String         | Coop's unique, immutable ID for this policy             |
| `policies[].name`                                 | String         | The display name you assigned to this policy            |
| `policies[].parentId`                             | String or null | Parent policy ID, or `null` for a top-level policy      |
| `policies[].policyText`                           | String or null | Policy text                                             |
| `policies[].enforcementGuidelines`                | String or null | Guidance for enforcement                                |
| `policies[].policyType`                           | String or null | Policy category, such as `VIOLENCE`                     |
| `policies[].semanticVersion`                      | Number         | Policy semantic version                                 |
| `policies[].userStrikeCount`                      | Number         | Configured user strike count                            |
| `policies[].applyUserStrikeCountConfigToChildren` | Boolean        | Whether child policies inherit the strike configuration |
| `policies[].penalty`                              | String         | `NONE`, `LOW`, `MEDIUM`, `HIGH`, or `SEVERE`            |

## Notes

- Use `parentId` to reconstruct the full policy tree. A `null` `parentId` indicates a top-level policy; a non-null `parentId` links a sub-policy to its parent.

- Build integrations against policy `id` values, not `name` values. Names can be changed in the dashboard; IDs are immutable.

- For background on how policies are structured and used, see [Basic Concepts](../user/concepts.md#policy) and [Administration](../user/administration.md#policies).
