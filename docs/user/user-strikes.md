# User Strikes

User Strikes track repeated policy violations against individual users on your platform, so escalating responses can be applied automatically. Configure them through policies and actions: Coop keeps count of strikes, and triggers further actions when configured thresholds are crossed.

![User Strikes overview, showing the Policy Scores tab with policies and the strike score weight assigned to each one](../images/coop-user-strikes.png)

Configure User Strikes under **Automated Enforcement → User Strikes**. The dashboard has four tabs.

## Policy Scores

Each policy can contribute a different weight to a user's strike score. A serious policy violation might add 3 to the score, while a minor one might add 1. The strike score is the running total across all violations within the configured strike window.

Sub-policies can either inherit their parent policy's weight or override it. Use the **Apply to sub-policies** toggle to set inheritance.

## Strike Enabled Actions

The Strike Enabled Actions tab lists every action your org has defined and lets you toggle which ones add to a user's strike score when applied. Not every action should count as a strike: for example a "send warning" action might not, while "remove content" or "ban account" should.

![Strike Enabled Actions tab listing each action with a toggle for whether it adds to the user's strike score](../images/coop-user-strike-actions.png)

Toggle the **Strike Enabled** column on for any action that should increment the score. Strike score is computed using the policy weights from the previous tab combined with the action that was taken.

## Thresholds & Settings

Define how long strikes stay on record and what happens when a user's strike score crosses a threshold.

![Thresholds & Settings tab showing the Strike Window (TTL) and a list of thresholds with associated actions](../images/coop-user-strike-thresholds.png)

**Strike Window** controls how long a strike stays on a user's record. Strikes older than the window are excluded from the running score. The same value is editable from [Settings → Other → User Strike TTL](settings.md#other).

**Thresholds** are score values that, when crossed, trigger an action automatically. Configure as many as you want. For example:

- Score 5: enqueue the user for manual review
- Score 10: temporarily restrict posting
- Score 20: ban the account

Actions in the dropdown come from your org's [defined actions](administration.md#actions).

## Analytics

A distribution chart of strike scores across users in your organization. Helps you tune thresholds before turning them on: if most active users sit at score 0 to 2 and a small tail is at 8 or above, a threshold at 8 will catch the worst offenders without trapping average users.

![Analytics tab showing a histogram of user strike scores across the org](../images/coop-user-strike-analytics.png)
