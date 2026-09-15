# Item Types API

Fetch your organization's current item schemas and field roles.

## Endpoint

```http
GET /api/v1/item_types/
```

Authentication: `X-API-KEY` header. See [API Keys & Authentication](../development/api-auth.md).

## Response

Returns `200` with an `itemTypes` array:

```json
{
  "itemTypes": [
    {
      "id": "item-type-id",
      "orgId": "org-id",
      "kind": "CONTENT",
      "name": "Post",
      "description": null,
      "schema": [
        {
          "name": "title",
          "type": "STRING",
          "required": true,
          "container": null
        }
      ],
      "schemaFieldRoles": { "displayName": "title" },
      "version": "version-id",
      "schemaVariant": "original"
    }
  ]
}
```

`kind` is `CONTENT`, `THREAD`, or `USER`. `schemaFieldRoles` maps roles to field names; unset roles are omitted. User item types also include `isDefaultUserType`, a boolean.

Only current original schemas are returned, not historical versions or partial variants. Use `id` when referencing an item type; its `version` changes when the configuration is updated.
