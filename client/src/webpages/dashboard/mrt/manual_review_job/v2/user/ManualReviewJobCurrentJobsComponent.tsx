import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';
import { useCallback, useMemo } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import { stringSort } from '../../../../components/table/sort';
import Table from '../../../../components/table/Table';

import { useGQLGetExistingJobsForItemQuery } from '../../../../../../graphql/generated';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '../../../../../../utils/time';

gql`
  query getExistingJobsForItem($itemId: ID!, $itemTypeId: ID!) {
    getExistingJobsForItem(itemId: $itemId, itemTypeId: $itemTypeId) {
      queueId
      job {
        createdAt
      }
    }
    myOrg {
      mrtQueues {
        id
        name
      }
    }
  }
`;
export default function ManualReviewCurrentJobsComponent(props: {
  userIdentifier: ItemIdentifier;
}) {
  const { userIdentifier } = props;
  const { data, loading } = useGQLGetExistingJobsForItemQuery({
    variables: {
      itemId: userIdentifier.id,
      itemTypeId: userIdentifier.typeId,
    },
    fetchPolicy: 'network-only',
  });

  const getQueueName = useCallback(
    (queueId: string) =>
      data?.myOrg?.mrtQueues.find((queue) => queue.id === queueId)?.name ??
      'Unknown',
    [data?.myOrg],
  );

  const columns = useMemo(
    () => [
      {
        Header: 'Queue',
        accessor: 'queue',
        canSort: true,
      },
      {
        Header: 'Created At',
        accessor: 'createdAt',
        sortDescFirst: true,
        sortType: stringSort,
      },
    ],
    [],
  );

  const dataValues = useMemo(() => {
    if (!data || !data.myOrg) {
      return undefined;
    }

    return data.getExistingJobsForItem.map((existingJobData) => ({
      queue: getQueueName(existingJobData.queueId),
      createdAt: existingJobData.job.createdAt,
    }));
  }, [data, getQueueName]);

  const tableData = useMemo(() => {
    if (!dataValues) {
      return undefined;
    }
    return (
      dataValues
        .slice(0, 10)
        .map((value) => {
          return {
            queue: <div>{value.queue}</div>,
            createdAt: (
              <div>
                {parseDatetimeToReadableStringInCurrentTimeZone(
                  new Date(value.createdAt),
                )}
              </div>
            ),
            values: value,
          };
        })
        // Sort in reverse-chronological order
        .sort(
          (a, b) =>
            new Date(b.values.createdAt).valueOf() -
            new Date(a.values.createdAt).valueOf(),
        )
    );
  }, [dataValues]);
  if (loading || !tableData) {
    return <ComponentLoading />;
  }

  if (data?.getExistingJobsForItem.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full text-start">
      <div className="mb-2 text-base font-semibold">
        Existing Jobs for this User From the Last 7 Days
      </div>
      <Table columns={columns} data={tableData} />
    </div>
  );
}
