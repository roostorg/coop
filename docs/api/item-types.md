# Item Types API

Fetch your organization's current item schemas and field roles.

## Endpoint

```http
GET /api/v1/item_types/
```

## Response

Returns `200` with an `itemTypes` array:

```json
{
  "itemTypes": [
    {
      "id": "item-type-id",
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

`kind` is `CONTENT`, `THREAD`, or `USER`.

Only current original schemas are returned, not historical versions or partial variants.
