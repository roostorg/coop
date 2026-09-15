# Item Types API

Fetch your organization's current item schemas and field roles.

## Create and update

```http
POST /api/v1/item_types/
PATCH /api/v1/item_types/item-type-id
```

```json
{
  "kind": "CONTENT",
  "name": "Post",
  "schema": [
    { "name": "title", "type": "STRING", "required": true, "container": null }
  ],
  "schemaFieldRoles": { "displayName": "title" }
}
```

Create requires `kind`, `name`, a non-empty `schema`, and
`schemaFieldRoles`, and returns `201`. `kind` is immutable and is not accepted
by PATCH. PATCH leaves omitted properties unchanged, replaces arrays, and
treats a supplied `schemaFieldRoles` object as the complete role mapping.
`hiddenFields` may be written but is not included in this API's response.

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
