# API Reference

Learn about the Coop API, including the REST API endpoints your platform uses to integrate with Coop.

All endpoints require an API key passed as an HTTP header on every request:

```http
X-API-KEY: <<apiKey>>
Content-Type: application/json
```

You can find or rotate your API key under **Settings** → **API Keys** in the Coop UI. For details on verifying the signatures Coop adds to outgoing webhook requests, see [API Keys & Authentication](../development/api-auth.md).

| Endpoint                     | Description                                                    |
| :--------------------------- | :------------------------------------------------------------- |
| `POST /api/v1/items/async/`  | [Items](items.md): send content for rule evaluation            |
| `POST /api/v1/report`        | [Report](report.md): submit a user report                      |
| `POST /api/v1/report/appeal` | [Appeal](appeal.md): submit a user appeal                      |
| `GET /api/v1/policies/`      | [Policies](policies.md): fetch your configured policies        |
| `GET /api/v1/user_scores`    | [User Scores](user-scores.md): fetch a user's moderation score |
| `POST /api/v1/gdpr/delete`   | [GDPR Deletion](gdpr.md): delete a user's data                 |

See also:

- [Handling Actions](actions.md): information about receiving action webhooks from Coop
- [Partial Items API](../api/partial-items.md): support Coop fetching Items and their attributes on demand
- [Errors](errors.md): details of error responses from Coop
