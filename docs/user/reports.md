# Reports

When a user on your platform reports content, you send that report to Coop's Report API. Coop uses this to create a moderation job, which gets routed to the appropriate review queue for a moderator to act on.

Reports are the primary way user-generated signals enter the moderation workflow. They carry the identity of the reporter, the content being reported, the reason for the report, and optional context like surrounding thread messages or the author's recent activity.

## What Coop does with a report

When your platform sends a report, Coop:

1. Creates a moderation job for the reported item
2. Evaluates any routing rules to determine which queue the job belongs in
3. Routes the job to that queue (or the default queue if no rule matches)
4. Makes the job available to the next available moderator in that queue

If `reportedForReason.csam` is `true`, the job is routed directly to the NCMEC queue rather than going through the normal routing rule evaluation. See [Child Safety (NCMEC)](child-safety.md) for details.

## Sending reports to Coop

Reports are submitted via `POST /api/v1/report`. For the full API schema (field definitions, types, and requirements), see the [Report API](../api/report.md) reference.

## Appeals

If a user wants to contest a moderation decision, that's handled through the Appeals API, a separate flow from reports. See [Appeals](appeals.md) for details.
