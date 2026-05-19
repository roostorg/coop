# Partial Items API

Enable Coop to fetch [Items](../user/concepts.md#item) and their details from your platform. Used to backfill historical data, fetch related items in the review console that haven't yet been sent to Coop, and ensure items are up-to-date when viewed.

> [!IMPORTANT]
> **It is not yet possible to configure this from the Coop UI**, so you'll have to manage it in code. See [roostorg/coop#378](https://github.com/roostorg/coop/issues/378) for details.

To use this API, your platform must provide a Partial Items API endpoint that can receive POST requests from Coop. When Coop needs to get information about a particular item from your platform, it sends a POST request to the endpoint with the requested item's unique ID. You'll need to update your Coop instance's code with the endpoint URL and any required headers so it can make the HTTP requests.

## REST API Example

Here's an example of a POST request that Coop would send to this endpoint:

```sh
curl --request POST \
    --url https://your-platform.example.com/partial-items \
    --header 'Content-Type: application/json' \
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

## Example Response

Your platform returns information about the item to Coop in its response. Even if it can't fetch _all_ attributes of the item (perhaps because of some limitations in your data model or query latency), your platform can just return as many attributes as you have access to. In other words, you can return a _partial_ version of the Item, even if some attributes are missing.

Coop expects a response in the following format:

```ts
{
  items: [
    {
      id: "abc123", // the `id` Coop provided in the request body
      typeId: "def456", // the `typeId` Coop provided in the request body
      data: { // the same `data` JSON object you'd provide if you had sent this Item via the Items API
        text: "some text uploaded by a user"
        // ... all other fields in your Item Type
      },
    },
    ... // other items
  ]
}
```
