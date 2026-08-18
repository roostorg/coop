# Metrics & Reporting

Coop tracks moderation activity across two surfaces: the Overview dashboard for operational metrics, and the Recent Decisions log for a full audit trail.

## Overview

![Coop overview with key operational metrics such as total actions taken, jobs pending review, percentage breakdown of automated vs manual actions, and top policy violations](../images/overview.png)

The Overview dashboard gives a high-level picture of moderation activity. All metrics can be filtered by an hourly or daily breakdown across a configurable time window. The overview displays:

- **Total actions taken**: Count of all moderation decisions in the selected window

- **Jobs pending review**: How many jobs are currently sitting in queues waiting for a moderator

- **Automated vs. manual actions**: Percentage breakdown of decisions made by proactive rules vs. human reviewers

- **Top policy violations**: Which policies account for the most actions taken

- **Decisions per moderator**: How work is distributed across your review team

- **Actions per rule**: Which rules are firing most frequently (only shown when rules are enabled)

- **Violations by policy**: Count of actions taken under each policy over time

## Recent Decisions

![Coop's recent decisions page showing a log of all actions taken in Coop and who took the action. There are buttons to refresh the table, download all decisions, and download only the jobs skipped by users](../images/recent-decisions.png)

Visit **Review Console** → **Recent Decisions** to review every action taken in Coop: who made the decision, on what content, and when. You can click through to the full job from any entry to investigate further or take an additional action.

The log covers two kinds of work, told apart by the **Origin** column:

- **Review Job** — a moderator resolved a job in a review queue.
- **Manual Action** — a moderator acted outside a queue, from [Bulk Actioning](bulk-actioning.md) or [Investigation](investigation.md).

Use the **Show** control to view all activity, queue decisions only, or manual actions only. Manual actions differ from decisions in a few ways worth knowing:

- A bulk run appears as **one row** with a count of the items it touched, not one row per item. Expand the row to list every item the run touched, with failures marked.
- Rows show how many items an action failed on, if any. This is the only place execution failures surface — a decision is recorded even when the actions it names never reached your platform. The failure reason is not recorded.
- Manual actions have no queue and no decision type. Applying a **Queue** or **decision-type** filter switches **Show** to `Decisions` and explains why, since neither filter can match a manual action. Clearing the filter restores whichever view you had chosen before.
- When actions are included in the feed, coverage is limited to a bounded recent window (the last 30 days). Switch **Show** to `Decisions` for the full, unbounded history — don't read an empty stretch further back as "nothing happened."

Manual actions are **not** filtered by child-safety permissions, and the log says so while they're shown. Review-job decisions on NCMEC jobs remain restricted to reviewers with the child-safety permission.

![Recent Decisions being filtered](../images/recent-decisions-filter.png)

The log can be downloaded in its entirety, or filtered according to decisions, policies, queues, moderators and date ranges and then downloaded. The export follows the **Show** control, so a decisions-only download keeps the original columns. This makes it particularly useful for:

- **Transparency reporting**: export decisions to include in reports to regulators or oversight bodies

- **QA and auditing**: sample decisions made by individual moderators or by automated rules to check for consistency and accuracy

- **Overturn workflows**: navigate from a logged decision back to the original job to reverse it if needed

You can also download a separate export of only the jobs that were _skipped_ by moderators, which can help identify content that may be systematically difficult to adjudicate.
