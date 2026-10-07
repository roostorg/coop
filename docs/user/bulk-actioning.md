# Bulk Actioning

Sometimes you may want to manually trigger an Action on one or more Items without adding it to a review queue and waiting for a moderator to review it. For example, a colleague might have escalated a piece of content that immediately needs to be deleted, or a law enforcement agency may reach out requesting that you ban a particular user for criminal activity.

With bulk actioning, you can manually trigger an Action on any Items as long as you have those Items' unique IDs. The process is:

1. Paste in the IDs of the Items you want to Action on. There is a limit of 1,000 Item IDs at once.

2. Select the Actions you want to apply to the Items.

3. Select the Policies you want to associate with the Actions.

4. Select **Execute Bulk Action**

That's it! The Actions will immediately be triggered.

## When to use bulk actioning

Bulk actioning is the right tool when:

- A colleague escalates urgent content that needs immediate enforcement—bypassing the queue avoids delays waiting for a moderator to claim the job
- A law enforcement request names specific user or content IDs that should be removed or preserved
- A backlog of IDs needs to be processed at once (e.g. cleaning up spam from a known bad actor across many posts)

For routine moderation, prefer queue review, which gives reviewers per-item context before they act. For looking up individual items and their history before deciding, use the [Investigation](investigation.md) tool.

## Important to note

- **No per-item context**: reviewers see only the IDs they paste in, not the item's content or history
- **Immediate and not reversible from the UI**: actions execute as soon as you confirm; there is no undo
- **No routing or signal evaluation**: items bypass rules and go straight to the selected action

## Logging

Bulk actions appear in the **Recent Decisions** log alongside queue-based decisions, so there is a full audit trail of what was actioned, by whom, and under which policies.

Use the **Show** control there to switch between all activity, queue decisions only, or manual actions only. The **Origin** column marks where each row came from — `Review Job` for a queue decision, `Manual Action` for anything taken from Bulk Actioning or Investigation.

A few things specific to manual action rows:

- Each bulk run is **one row**, not one per item, with a count of the items it touched. Expand the row to see every item the run touched, with failures marked.
- If any action failed to reach your platform, the row shows how many failed. The failure reason is not recorded.
- Manual actions have no queue and no decision type, so applying a **Queue** or **decision-type** filter switches the log's Show control to `Decisions` and explains why. Clearing the filter restores your previous view.
- Manual actions are **not** filtered by child-safety permissions — unlike review-job decisions on NCMEC jobs, which stay restricted to reviewers with the child-safety permission.
- When manual actions are included, the log only covers a bounded recent window; switch to `Decisions` for unbounded history.
- The **Download** button exports whatever the Show control is set to. A decisions-only export keeps the original columns, so existing tooling is unaffected.
