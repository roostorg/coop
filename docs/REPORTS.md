# Reports

These are the fields that Coop expects in the body of the request:

| Property | Type | Required? | Description |
| :---- | :---- | :---- | :---- |
| reporter | Reporter | Required | The user that reported the Item you're sending. See the Reporter schema below for details. |
| reportedAt | Datetime | Required | The datetime indicating the exact time at which the Item was reported. Datetimes should be formatted as [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) strings. |
| reportedItem | ReportedItem | Required | The Item that was reported. See the ReportedItem schema below for details. |
| reportedForReason | ReportedForReason | Optional | The reason that this Item was reported. See the ReportedForReason schema below for details. |
| reportedItemThread | Array\<ReportedItem\> | Optional | If the reportedItem is just one piece of content within a larger thread (e.g. a comment thread or a direct message thread), then you can include previous (and subsequent) messages from that thread inside this report. That way, you can view the full thread as you're reviewing the report to get maximal context. |
| reportedItemsInThread | Array\<ItemIdentifier\> | Optional | Indicates if an item in the reportedItemThread was reported specifically. This will cause a tag to show up in the ticket for the report in the Manual Review Tool next to the reported Items. |
| additionalItems | Array\<ReportedItem\> | Optional | If you want to render other pieces of content along with your report (e.g. the previous five posts made by the author of the reported content) for additional context, you can include those here in your report. |

#### Reporter schema:

| Property | Type | Required? | Description |
| :---- | :---- | :---- | :---- |
| kind | String | Required | The type of entity that reported the content. For now, the only supported entity type is 'user', so please set this field to the value 'user'. |
| id | String | Required | Your unique identifier for the user who reported this Item. |
| typeId | String | Required | The ID of this user's Item Type. This should exactly match the ID of one of the Item Types that you defined in the Item Types Dashboard. The ID of each Item Type can be found in that dashboard. |

#### ReportedItem schema:

| Property | Type | Required? | Description |
| :---- | :---- | :---- | :---- |
| id | String | Required | Your unique identifier for the Item that is being reported. |
| typeId | String | Required | The ID of the Item Type that corresponds to the Item being reported. This should exactly match the ID of one of the Item Types that you defined in the Item Types Dashboard. |
| data | JSON | Required | This is a JSON containing the Item itself. In the Item Types Dashboard, you defined a schema for each Item Type. This data JSON must contain the fields you defined in the schema of the Item Type that corresponds to the reported Item. We'll return an error if any of the required fields are missing, if any of the types mismatch, or if any additional fields are included. Note: This is the same data JSON that you send Coop in the Item API. |

#### ItemIdentifier schema:

| Property | Type | Required? | Description |
| :---- | :---- | :---- | :---- |
| id | String | Required | Your unique identifier for the Item that is being reported. |
| typeId | String | Required | The ID of the Item Type that corresponds to the Item being reported. This should exactly match the ID of one of the Item Types that you defined in the Item Types Dashboard. |

#### ReportedForReason schema:

| Property | Type | Required? | Description |
| :---- | :---- | :---- | :---- |
| policyId | String | Optional | Some reporting flows allow users to select the reason they're reporting an Item. For example, a user might report an Item for Hate, or for Spam, or for Harassment. If you would like to map those reasons to the Policies you set up in your Policies Dashboard, you can specify the ID of the relevant Policy in this policyId field. |
| reason | String | Optional | If you allow users to write additional freeform text associated with the report to indicate why they're submitting the report, you can add that here. |

ReportedItemThread schema:

* This is just an array of `ReportedItem` objects.  
* **Data Field Flexibility:** Coop does not strictly enforce that every required field in the Item Type schema is present in the `data` field. This is to allow for retroactive fetching where some data might be unavailable.  
* **Chronological Order:** Every Item in the array should include a creation `datetime` (ISO 8601 string) to ensure proper chronological display. If an Item in the thread does *not* have a `datetime`, the `reportedItem` itself must be included in the `reportedItemThread` array so Coop can establish the reported Item's chronological position.