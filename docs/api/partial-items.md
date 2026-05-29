# Partial Items API

Enable Coop to fetch [Items](../user/concepts.md#item) and their details from your platform. Used to backfill historical data, fetch related items in the review console that haven't yet been sent to Coop, and ensure items are up-to-date when viewed.

## Setting up your endpoint

To use this API, your platform must provide a Partial Items API endpoint that can receive POST requests from Coop. When Coop needs to get information about a particular item from your platform, it sends a POST request to the endpoint with the requested item's unique ID.

To verify that an incoming request actually came from Coop, check the `Coop-Signature` header. See [API Keys & Authentication](../development/api-auth.md#verifying-incoming-requests-from-coop) for the signature verification algorithm and a code example.

> [!IMPORTANT]
> **It is not yet possible to configure this from the Coop UI**, so you'll have to manage it in code. See [roostorg/coop#378](https://github.com/roostorg/coop/issues/378) for details.

You'll need to update your Coop instance's code with the endpoint URL and any required headers (including any additional authentication, such as an API key) so it can make the HTTP requests.

## REST API example

Here's an example of a POST request that Coop would send to this endpoint:

```sh
curl --request POST \
    --url https://your-platform.example.com/partial-items \
    --header 'Content-Type: application/json' \
    --header 'Coop-Signature: t=1234567890,v1=5f7d8e9...' \
    --data '{
        "items": [
            {
                "id": "abc123",
                "typeId": "def456"
            },
            {
                "id": "xyz789",
                "typeId": "def456"
            }
        ]
    }'
```

In the body of the request, there is only one top-level property called `items`, which is an array of objects representing the Items about which Coop needs more information. This property is an array so that Coop can request batches of multiple Items within a single API request, when needed.

In each object in the `items` array, Coop expects the following fields:

| Property | Type     | Description                                                                                                                                                                                            |
| :------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | `String` | Your unique identifier for this Item                                                                                                                                                                   |
| `typeId` | `String` | The ID of the [Item Type](../user/concepts.md#item-type) that corresponds to the Item. This will exactly match the ID of one of the Item Types you've [defined](../user/administration.md#item-types). |

## Response requirements

Your endpoint must respond with a `2xx` status and a JSON body containing a single top-level object with an `items` array. Extra top-level keys are accepted but ignored; only `items` is consumed.

Each entry in `items` describes one of the items Coop asked about. You can return a _partial_ version of the Item `data` may contain only the subset of fields you have access to, but the keys below must be present and well-typed:

| Property            | Type                      | Required | Description                                                                                           |
| :------------------ | :------------------------ | :------- | :---------------------------------------------------------------------------------------------------- |
| `id`                | `String`                  | Yes      | The `id` Coop provided in the request body.                                                           |
| `typeId`            | `String`                  | Yes      | The `typeId` Coop provided in the request body.                                                       |
| `data`              | `Object`                  | Yes      | The same shape you'd send via the Items API. May be empty (`{}`), but the key itself must be present. |
| `typeVersion`       | `String`                  | No       | Specific Item Type version to target.                                                                 |
| `typeSchemaVariant` | `"original" \| "partial"` | No       | Defaults to `partial`.                                                                                |

Example response:

```json
{
  "items": [
    {
      "id": "abc123", // the `id` Coop provided
      "typeId": "def456", // the `typeId` Coop provided
      "data": {
        // the same shape you'd send via the Items API
        "text": "some text uploaded by a user"
        // ... all other fields in your Item Type
      }
    }
  ]
}
```

If you can't find or return a particular item, **omit it** from the `items` array rather than returning an error or a sentinel value. Coop won't treat a missing item as a failure; it simply won't have data for that item. Items whose `(id, typeId)` did not appear in the request are silently dropped.

A nested form is also accepted in which `typeId`, `typeVersion`, and `typeSchemaVariant` are grouped under a `type` object as `id`, `version`, and `schemaVariant`. The flat form above is recommended for new integrations; this nested form only exists for parity with the Items API submission shape.

```json
{
  "items": [
    {
      "id": "abc123",
      "data": { "text": "..." },
      "type": {
        "id": "def456",
        "version": "2025-01-01",
        "schemaVariant": "partial"
      }
    }
  ]
}
```

## Troubleshooting

If a request shows up in your webhook logs but doesn't update the item in Coop, the UI will surface one of these:

- **`PartialItemsEndpointResponseError`**: the endpoint returned a non-2xx status.
- **`PartialItemsInvalidResponseError`**: the body parsed as JSON but didn't match the schema above (most often a missing `data`, a missing top-level `items` key, or non-string `id`/`typeId`), _or_ it couldn't be parsed as JSON at all. When the body fails to parse, Coop's server logs include a short prefix of the response bytes; the most common cause is writing to the response twice (e.g. a middleware emitting a sentinel before the payload, producing something like `null{"items":[...]}`).

If the request looks successful but the item still doesn't appear, verify that each returned item's `(id, typeId)` exactly matches what Coop asked for; mismatches are silently dropped. If you're testing through a tunnel (`localtunnel`, `ngrok`), make sure the tunnel isn't injecting a browser-warning page in place of your response.
