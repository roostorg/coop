# API Reference

This section documents the REST API endpoints your platform uses to integrate with Coop.

All endpoints require an API key passed as an HTTP header on every request:

```
X-API-KEY: <<apiKey>>
Content-Type: application/json
```

You can find or rotate your API key under **Settings → API Keys** in the Coop UI. For details on verifying the signatures Coop adds to outgoing webhook requests, see [API Keys and Authentication](../development/api-auth.md).

## Endpoints

| Endpoint                     | Description                                                                |
| :--------------------------- | :------------------------------------------------------------------------- |
| `POST /api/v1/items/async/`  | [Submit Items](items.md): send content for rule evaluation                 |
| `POST /api/v1/report`        | [Report API](report.md): submit a user report                              |
| `POST /api/v1/report/appeal` | [Appeal API](appeal.md): submit a user appeal                              |
| `GET /api/v1/policies/`      | [Policies](policies.md): fetch your configured policies                    |
| `GET /api/v1/user_scores`    | [User Scores](user-scores.md): fetch a user's moderation score             |
| `POST /api/v1/gdpr/delete`   | [GDPR Deletion](gdpr.md): delete a user's data                             |
| Configured per Action        | [Handle Moderation Actions](actions.md): receive action webhooks from Coop |
