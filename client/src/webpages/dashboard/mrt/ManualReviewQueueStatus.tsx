import { Button } from '@/coop-ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/coop-ui/Card';
import { useMemo } from 'react';

import { useGQLManualReviewQueuesQuery } from '../../../graphql/generated';

export default function ManualReviewQueueStatus() {
  const { data, loading, error, refetch } = useGQLManualReviewQueuesQuery({
    fetchPolicy: 'no-cache',
    notifyOnNetworkStatusChange: true,
  });
  const sampledAt = useMemo(
    () => (loading || error || !data ? undefined : Date.now()),
    [data, loading, error],
  );
  const queues = data?.me?.reviewableQueues;
  const panels = [
    {
      title: 'Pending jobs by queue',
      description:
        'Current waiting, paused, delayed, prioritized and waiting-for-children jobs. Actively claimed jobs are excluded. This is a snapshot, not an arrival count.',
      heading: 'Jobs',
      value: (queue: NonNullable<typeof queues>[number]) =>
        Number.isSafeInteger(queue.pendingJobCount) &&
        queue.pendingJobCount >= 0
          ? queue.pendingJobCount.toLocaleString()
          : 'Unavailable',
    },
    {
      title: 'Reported oldest pending age by queue',
      description:
        'Minutes since the job creation time returned by Coop. The existing lookup checks the first waiting and delayed jobs only. It is not guaranteed to be the oldest across all pending jobs or states; unavailable does not mean zero.',
      heading: 'Minutes',
      value: (queue: NonNullable<typeof queues>[number]) => {
        if (!queue.oldestJobCreatedAt || sampledAt === undefined)
          return 'Unavailable';
        const elapsed =
          sampledAt - new Date(queue.oldestJobCreatedAt).getTime();
        return Number.isFinite(elapsed) && elapsed >= 0
          ? (elapsed / 60000).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })
          : 'Unavailable';
      },
    },
  ];

  return (
    <section aria-label="Queue status">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Current queues you can review, independent of the Analytics date
          range. Loaded on opening this tab; use Refresh to update. No automatic
          polling.
        </p>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void refetch().catch(() => undefined)}
        >
          Refresh queue status
        </Button>
      </div>
      {loading ? (
        <p role="status">Loading queue status…</p>
      ) : error || !queues || sampledAt === undefined ? (
        <p role="alert">Queue status is unavailable. Try refreshing.</p>
      ) : queues.length === 0 ? (
        <p>No review queues are available to you.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Snapshot displayed at {new Date(sampledAt).toLocaleString()}. Counts
            and ages are separate reads, not an atomic snapshot.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {panels.map((panel) => (
              <Card key={panel.title}>
                <CardHeader>
                  <CardTitle>{panel.title}</CardTitle>
                  <CardDescription>{panel.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <table
                    className="w-full text-left text-sm"
                    aria-label={panel.title}
                  >
                    <thead>
                      <tr>
                        <th scope="col" className="py-2">
                          Queue
                        </th>
                        <th scope="col" className="py-2 text-right">
                          {panel.heading}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {queues.map((queue) => (
                        <tr key={queue.id} className="border-t">
                          <th scope="row" className="py-2 font-normal">
                            {queue.name}
                            {queue.isAppealsQueue ? ' (Appeals)' : ''}
                          </th>
                          <td className="py-2 text-right">
                            {panel.value(queue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
