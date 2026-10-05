# Queue status in Review Analytics

Open **Review Console → Analytics → Queue status** to see two snapshots for the queues you can review:

- **Pending jobs by queue:** the existing queue count, including waiting, paused, delayed, prioritized and waiting-for-children jobs. Actively claimed jobs are excluded.
- **Reported oldest pending age by queue:** minutes since the creation timestamp returned by the existing queue lookup. This lookup compares the first waiting and delayed candidates only. It is not guaranteed to find the oldest job across all pending jobs or states.

The tab loads on opening and updates when you select **Refresh queue status**. There is no background polling. The historical date-range filter does not apply to this tab.

The displayed time is when your browser displayed the response, not a server snapshot timestamp. Counts and ages come from separate reads and can change between those reads. Age is computed against the browser clock, so an incorrect local clock can affect it. This view is for operational inspection, not an exact backlog-age SLA.

Loading and error states hide previous values. An unavailable count or age is shown as **Unavailable**, never as a healthy zero. A zero count means the existing query returned zero; an empty queue list means no reviewable queues were returned for your account.

The feature reuses the existing `ManualReviewQueues` GraphQL query and queue permissions. It does not introduce a new API, change review decisions or locks, or export data to a metrics backend.
