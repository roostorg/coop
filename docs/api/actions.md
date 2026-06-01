# Handling Actions

When Coop triggers an Action—either through an automated rule or a moderator's decision in the Review Console—it sends a POST request to the callback URL you configured for that Action. Your server receives this request and performs the corresponding operation.

## Setting up your callback endpoint

For each Action you define in Coop, provide a publicly accessible callback URL and any authentication headers your endpoint requires (e.g. an API key Coop should send). Coop includes these headers on every outgoing request to that endpoint.

To verify that an incoming request actually came from Coop, check the `Coop-Signature` header. See [API Keys & Authentication](../development/api-auth.md#verifying-incoming-requests-from-coop) for the signature verification algorithm and a code example.

Failed deliveries are retried up to five times with exponential backoff.

## Request body

```json
{
  "item": { "id": "item-id", "typeId": "item-type-id" },
  "action": { "id": "action-id" },
  "policies": [{ "id": "policy-id", "name": "Spam", "penalty": "MEDIUM" }],
  "rules": [{ "id": "rule-id", "name": "Spam detector" }],
  "custom": {},
  "actorEmail": "moderator@example.com"
}
```

### Field reference

| Field        | Type            | Always present? | Description                                                                                                   |
| :----------- | :-------------- | :-------------- | :------------------------------------------------------------------------------------------------------------ |
| `item`       | Item            | Always          | The item that should receive this Action                                                                      |
| `action`     | Action          | Always          | The Action being triggered                                                                                    |
| `policies`   | Array\<Policy\> | Always          | Policies associated with this action. May contain multiple entries if several rules triggered the same action |
| `rules`      | Array\<Rule\>   | Not always      | Rules that triggered this action. Empty if triggered via manual review or bulk actioning                      |
| `custom`     | Object          | Not always      | Custom parameters configured in the Action form under "Body"                                                  |
| `actorEmail` | String          | Not always      | Email of the Coop user who took the action. Omitted for automated rule-triggered actions                      |
| `actorNote`  | String          | Not always      | Note added by the moderator when taking the action. Omitted if no note was provided                           |

**Item schema:**

| Field      | Type   | Description                         |
| :--------- | :----- | :---------------------------------- |
| `id`       | String | Your unique identifier for the item |
| `typeId`   | String | The Item Type ID                    |
| `typeName` | String | The display name of the Item Type   |

**Policy schema:**

| Field     | Type   | Description                                                 |
| :-------- | :----- | :---------------------------------------------------------- |
| `id`      | String | Coop's unique policy ID                                     |
| `name`    | String | Policy name                                                 |
| `penalty` | String | Penalty level: `NONE`, `LOW`, `MEDIUM`, `HIGH`, or `SEVERE` |

**Rule schema:**

| Field  | Type   | Description           |
| :----- | :----- | :-------------------- |
| `id`   | String | Coop's unique rule ID |
| `name` | String | Rule name             |

## Appeal decision callback

When a moderator reviews an appeal in the Review Console and makes a decision, Coop sends a POST request to the Appeal callback URL configured in your Appeals Dashboard.

```json
{
  "appealId": "your-appeal-id",
  "item": { "id": "item-id", "typeId": "item-type-id" },
  "appealedBy": { "id": "user-id", "typeId": "user-type-id" },
  "appealDecision": "ACCEPT",
  "custom": {}
}
```

### Appeal callback field reference

| Field            | Type           | Always present? | Description                                                                                                  |
| :--------------- | :------------- | :-------------- | :----------------------------------------------------------------------------------------------------------- |
| `appealId`       | String         | Always          | Your internal appeal ID, as sent via the Appeal API                                                          |
| `item`           | Item           | Always          | The item that originally received the moderation action                                                      |
| `appealedBy`     | ItemIdentifier | Always          | The user who submitted the appeal                                                                            |
| `appealDecision` | String         | Always          | `ACCEPT` means the original action was incorrect (appeal granted); `REJECT` means the original action stands |
| `custom`         | Object         | Not always      | Custom parameters configured in the Appeal Configuration Form under "Body"                                   |

For the full appeal submission flow, see [Appeals](../user/appeals.md).
