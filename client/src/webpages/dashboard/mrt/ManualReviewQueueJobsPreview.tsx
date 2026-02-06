import { gql } from '@apollo/client';
import moment from 'moment';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Row } from 'react-table';

import ComponentLoading from '../../../components/common/ComponentLoading';
import DashboardHeader from '../components/DashboardHeader';
import {
  ColumnProps,
  DateRangeColumnFilter,
  SelectColumnFilter,
} from '../components/table/filters';
import { stringSort } from '../components/table/sort';
import Table from '../components/table/Table';

import { useGQLManualReviewQueueJobsPreviewQuery } from '../../../graphql/generated';
import { filterNullOrUndefined } from '../../../utils/collections';
import { getPrimaryContentFields } from '../../../utils/itemUtils';
import { ITEM_FRAGMENT } from '../item_types/ItemTypesDashboard';
import FieldsComponent from './manual_review_job/v2/ManualReviewJobFieldsComponent';

gql`
  ${ITEM_FRAGMENT}
  query ManualReviewQueueJobsPreview($queueIds: [ID!]) {
    myOrg {
      policies {
        id
        name
      }
    }
    me {
      id
      permissions
      reviewableQueues(queueIds: $queueIds) {
        id
        name
        description
        pendingJobCount
        jobs {
          id
          createdAt
          policyIds
          payload {
            ... on ContentManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on UserManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on ThreadManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on ContentAppealManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on UserAppealManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on ThreadAppealManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
            ... on NcmecManualReviewJobPayload {
              item {
                ... on ItemBase {
                  ...ItemFields
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default function ManualReviewQueueJobsPreview() {
  const { queueId } = useParams<{
    queueId: string | undefined;
  }>();
  const { loading, data } = useGQLManualReviewQueueJobsPreviewQuery({
    variables: {
      queueIds: [queueId!],
    },
    skip: queueId === undefined,
    fetchPolicy: 'no-cache',
  });

  const queue = data?.me?.reviewableQueues?.[0] ?? undefined;
  const policies = useMemo(() => data?.myOrg?.policies ?? [], [data?.myOrg]);

  const columns = useMemo(
    () => [
      {
        Header: 'Preview',
        accessor: 'preview',
        canSort: false,
      },
      {
        Header: 'Policies',
        accessor: 'policies',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'policies',
          }),
        filter: 'includes',
        canSort: false,
      },
      {
        Header: 'Created At',
        accessor: 'createdAt',
        Filter: (props: ColumnProps) =>
          DateRangeColumnFilter({
            columnProps: props,
            accessor: 'createdAt',
            placeholder: '',
          }),
        filter: 'dateRange',
        sortDescFirst: true,
        sortType: stringSort,
      },
    ],
    [],
  );
  const dataValues = useMemo(
    () =>
      queue
        ? filterNullOrUndefined(queue.jobs).map((jobData) => {
            return {
              jobId: jobData.id,
              createdAt: jobData.createdAt,
              itemId: jobData.payload.item.id,
              itemData: jobData.payload.item.data,
              itemType: jobData.payload.item.type,
              policies: jobData.policyIds.map(
                (id) => policies.find((it) => it.id === id)?.name,
              ),
            };
          })
        : [],
    [policies, queue],
  );

  const tableData = useMemo(
    () =>
      dataValues.map((values) => {
        return {
          preview: (
            <FieldsComponent
              fields={getPrimaryContentFields(
                values.itemType.baseFields,
                values.itemData,
              )}
              itemTypeId={values.itemType.id}
              options={{
                maxWidthImage: 100,
                maxHeightImage: 100,
                maxWidthVideo: 100,
                unblurAllMedia: false,
              }}
            />
          ),
          policies: (
            <div className="flex flex-wrap gap-1">
              {values.policies.map((policyName, index) => (
                <div
                  key={index}
                  className={`flex px-2 py-0.5 rounded font-semibold bg-slate-200 text-slate-500`}
                >
                  {policyName}
                </div>
              ))}
            </div>
          ),
          createdAt: (
            <div>{moment(values.createdAt).format('MM/DD/YY hh:mm A')}</div>
          ),
          jobId: values.jobId,
          values,
        };
      }),
    [dataValues],
  );

  if (loading) {
    return <ComponentLoading />;
  }

  if (!queueId) {
    throw new Error('Queue ID is required');
  }
  if (!queue) {
    throw Error(`Queue not found for ID ${queueId}`);
  }

  const rowLinkTo = (row: Row<any>) => {
    // I don't know why but the jobs do not ever render unless you put a fake lock token
    // at the end of the URL, so the `/1` is actually necessary here
    return `/dashboard/manual_review/queues/review/${queueId}/${row.original.jobId}/1`;
  };

  return (
    <div>
      <DashboardHeader title={`Jobs in ${queue.name}`} />
      <Table rowLinkTo={rowLinkTo} columns={columns} data={tableData} />
    </div>
  );
}
