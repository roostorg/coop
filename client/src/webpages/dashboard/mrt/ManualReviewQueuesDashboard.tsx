import { StarFilled, TapFilled } from '@/icons';
import { ReactComponent as AngleDoubleRight } from '@/icons/lni/Direction/angle-double-right.svg';
import { ReactComponent as GridAlt } from '@/icons/lnif/Design/grid-alt.svg';
import { ReactComponent as Star } from '@/icons/lni/Web and Technology/star.svg';
import { gql } from '@apollo/client';
import Button from 'antd/lib/button';
import Checkbox from 'antd/lib/checkbox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import DashboardHeader from '../components/DashboardHeader';
import RowMutations, { DeleteRowModalInfo } from '../components/RowMutations';
import TabBar from '../components/TabBar';
import { ColumnProps, DefaultColumnFilter } from '../components/table/filters';
import { dateSort, integerSort, stringSort } from '../components/table/sort';
import Table from '../components/table/Table';

import {
  GQLUserPermission,
  namedOperations,
  useGQLAddFavoriteMrtQueueMutation,
  useGQLDeleteAllJobsFromQueueMutation,
  useGQLDeleteManualReviewQueueMutation,
  useGQLGetResolvedJobsForUserQuery,
  useGQLGetSkippedJobsForUserQuery,
  useGQLManualReviewQueuesQuery,
  useGQLRemoveFavoriteMrtQueueMutation,
  useGQLRoutingRulesQuery,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';
import { filterNullOrUndefined } from '../../../utils/collections';

gql`
  query ManualReviewQueues {
    myOrg {
      hasAppealsEnabled
      previewJobsViewEnabled
    }
    me {
      id
      permissions
      favoriteMRTQueues {
        id
      }
      reviewableQueues {
        id
        name
        description
        pendingJobCount
        oldestJobCreatedAt
        isDefaultQueue
        isAppealsQueue
      }
    }
  }

  query RoutingRules {
    myOrg {
      id
      routingRules {
        id
        name
        destinationQueue {
          id
        }
      }
    }
  }

  mutation DeleteManualReviewQueue($id: ID!) {
    deleteManualReviewQueue(id: $id)
  }

  mutation DeleteAllJobsFromQueue($queueId: ID!) {
    deleteAllJobsFromQueue(queueId: $queueId) {
      ... on DeleteAllJobsFromQueueSuccessResponse {
        _
      }
      ... on Error {
        title
      }
    }
  }

  mutation AddFavoriteMRTQueue($queueId: ID!) {
    addFavoriteMRTQueue(queueId: $queueId) {
      ... on AddFavoriteMRTQueueSuccessResponse {
        _
      }
    }
  }

  mutation RemoveFavoriteMRTQueue($queueId: ID!) {
    removeFavoriteMRTQueue(queueId: $queueId) {
      ... on RemoveFavoriteMRTQueueSuccessResponse {
        _
      }
    }
  }

  query getResolvedJobsForUser($timeZone: String!) {
    getResolvedJobsForUser(timeZone: $timeZone)
  }

  query getSkippedJobsForUser($timeZone: String!) {
    getSkippedJobsForUser(timeZone: $timeZone)
  }
`;

type DeleteAllJobsModalInfo = {
  id: string;
  visible: boolean;
};

const MRTQueuesDashboardTabs = ['DEFAULT', 'APPEALS'] as const;
type MRTQueuesDashboardTab = (typeof MRTQueuesDashboardTabs)[number];

// Utility function to format time ago
const formatTimeAgo = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A';
  
  const now = new Date().getTime();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

// Get color class based on age
const getAgeColorClass = (date: string | Date | null | undefined): string => {
  if (!date) return 'text-gray-500';
  
  const now = new Date().getTime();
  const then = new Date(date).getTime();
  const diffHours = (now - then) / 3600000;
  
  if (diffHours > 24) return 'text-red-600 font-semibold'; // Over 1 day - red
  if (diffHours > 4) return 'text-orange-600'; // Over 4 hours - orange
  return 'text-green-600'; // Under 4 hours - green
};

// Column visibility configuration
type ColumnId = 'favoriteQueues' | 'id' | 'name' | 'description' | 'oldestTaskAge' | 'pendingJobCount' | 'startReviewing' | 'mutations' | 'deleteJobs' | 'previewJobs';

const COLUMN_VISIBILITY_STORAGE_KEY = 'mrt-queues-column-visibility';

const defaultColumnVisibility: Record<ColumnId, boolean> = {
  favoriteQueues: true,
  id: true,
  name: true,
  description: true,
  oldestTaskAge: true,
  pendingJobCount: true,
  startReviewing: true,
  mutations: true,
  deleteJobs: true,
  previewJobs: true,
};

const columnLabels: Record<ColumnId, string> = {
  favoriteQueues: 'Favorite',
  id: 'ID',
  name: 'Name',
  description: 'Description',
  oldestTaskAge: 'Oldest Task Age',
  pendingJobCount: 'Pending Jobs',
  startReviewing: 'Start Reviewing',
  mutations: 'Actions',
  deleteJobs: 'Delete Jobs',
  previewJobs: 'Preview Jobs',
};

export default function ManualReviewQueuesDashboard() {
  const { loading, data, refetch } = useGQLManualReviewQueuesQuery({
    fetchPolicy: 'no-cache',
    pollInterval: 5000,
  });
  const [deleteReviewQueue] = useGQLDeleteManualReviewQueueMutation({
    onError: () => {},
    onCompleted: async () => refetch(),
  });
  const [addFavoriteMRTQueue] = useGQLAddFavoriteMrtQueueMutation({
    onCompleted: async () => refetch(),
  });
  const [removeFavoriteMRTQueue] = useGQLRemoveFavoriteMrtQueueMutation({
    onCompleted: async () => refetch(),
  });

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (stored) {
        return { ...defaultColumnVisibility, ...JSON.parse(stored) };
      }
    } catch (e) {
      // Failed to load from localStorage, use defaults
    }
    return defaultColumnVisibility;
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch (e) {
      // Failed to save to localStorage
    }
  }, [columnVisibility]);

  const toggleColumnVisibility = useCallback((columnId: ColumnId) => {
    setColumnVisibility(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  }, []);

  const [columnsMenuVisible, setColumnsMenuVisible] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Close columns menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setColumnsMenuVisible(false);
      }
    };

    if (columnsMenuVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [columnsMenuVisible]);

  const { data: resolvedJobsCount } = useGQLGetResolvedJobsForUserQuery({
    variables: {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const { data: getSkippedJobsForUser } = useGQLGetSkippedJobsForUserQuery({
    variables: {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const { data: routingRulesData } = useGQLRoutingRulesQuery({
    fetchPolicy: 'no-cache',
    skip: !userHasPermissions(data?.me?.permissions, [
      GQLUserPermission.EditMrtQueues,
    ]),
  });

  const queues = data?.me?.reviewableQueues;
  const routingRules = routingRulesData?.myOrg?.routingRules;
  const favoriteQueues = data?.me?.favoriteMRTQueues?.map((it) => it.id);
  const previewJobsViewEnabled = data?.myOrg?.previewJobsViewEnabled ?? false;
  const navigate = useNavigate();
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);
  const [deleteAllJobsModalInfo, setDeleteAllJobsModalInfo] =
    useState<DeleteAllJobsModalInfo | null>(null);
  const [deleteAllJobsFromQueue] = useGQLDeleteAllJobsFromQueueMutation({
    onError: () => {},
    onCompleted: async () => refetch(),
  });
  const [selectedTab, setSelectedTab] =
    useState<MRTQueuesDashboardTab>('DEFAULT');
  const startReviewing = useCallback(
    (id: string, pendingJobCount: number) => {
      return (
        <Button
          className="flex items-center justify-center w-full p-4 text-sm text-gray-600 bg-white border border-gray-200 border-solid shadow-none cursor-pointer rounded-md drop-shadow-none hover:border-gray-200 focus:border-gray-200 hover:bg-gray-100 hover:text-gray-600 focus:text-gray-600"
          onClick={() => navigate(`review/${id}`)}
          disabled={pendingJobCount === 0}
        >
          Start Reviewing
        </Button>
      );
    },
    [navigate],
  );
  const onCancel = () => setModalInfo(null);

  const labelForTab = (tab: MRTQueuesDashboardTab) => {
    switch (tab) {
      case 'DEFAULT':
        return 'Reports';
      case 'APPEALS':
        return 'Appeals';
    }
  };
  const hasAppealsEnabled = data?.myOrg?.hasAppealsEnabled ?? false;
  const tabs = MRTQueuesDashboardTabs.filter((x) => {
    if (hasAppealsEnabled) {
      return x;
    } else {
      return x !== 'APPEALS';
    }
  }).map((value) => ({
    label: labelForTab(value),
    value,
  }));
  const tabBar = (
    <TabBar
      tabs={tabs}
      initialSelectedTab={selectedTab ?? 'DEFAULT'}
      onTabClick={(val) => setSelectedTab(val)}
      currentSelectedTab={selectedTab}
    />
  );

  const deleteAllJobsModal = (
    <CoopModal
      title={
        queues == null || modalInfo == null
          ? 'Delete All Jobs From Queue'
          : `Delete All Jobs From '${
              queues.find((it) => it.id === modalInfo.id)!.name
            }'`
      }
      visible={deleteAllJobsModalInfo?.visible ?? false}
      footer={[
        {
          title: 'Cancel',
          onClick: () => setDeleteAllJobsModalInfo(null),
          type: 'secondary',
        },
        {
          title: 'Confirm',
          onClick: () => {
            deleteAllJobsFromQueue({
              variables: { queueId: deleteAllJobsModalInfo!.id },
            });
            setDeleteAllJobsModalInfo(null);
          },
        },
      ]}
    >
      Are you sure you want to delete all jobs from this queue? You can't undo
      this action. For larger queues, this can take a few minutes.
    </CoopModal>
  );

  const deleteModal = (
    <CoopModal
      title={
        queues == null || modalInfo == null
          ? 'Delete Queue'
          : `Delete '${queues.find((it) => it.id === modalInfo.id)!.name}'`
      }
      visible={modalInfo?.visible ?? false}
      footer={[
        {
          title: 'Cancel',
          onClick: onCancel,
          type: 'secondary',
        },
        {
          title: 'Delete',
          onClick: () => {
            onDeleteReviewQueue(modalInfo!.id);
            setModalInfo(null);
          },
          type: 'primary',
        },
      ]}
      onClose={onCancel}
    >
      Are you sure you want to delete this queue? This will delete all jobs
      inside of this queue as well. You can't undo this action.
    </CoopModal>
  );

  const onDeleteReviewQueue = (id: string) => {
    deleteReviewQueue({
      variables: { id },
    });
  };
  const onAddFavoriteQueue = useCallback(
    (queueId: string) => {
      addFavoriteMRTQueue({
        variables: {
          queueId,
        },
        refetchQueries: [namedOperations.Query.ManualReviewQueues],
      });
    },
    [addFavoriteMRTQueue],
  );
  const onRemoveFavoriteQueue = useCallback(
    (queueId: string) => {
      removeFavoriteMRTQueue({
        variables: {
          queueId,
        },
        refetchQueries: [namedOperations.Query.ManualReviewQueues],
      });
    },
    [removeFavoriteMRTQueue],
  );

  const columns = useMemo(
    () => filterNullOrUndefined([
      columnVisibility.favoriteQueues ? {
        Header: '',
        accessor: 'favoriteQueues',
        canSort: false,
      } : undefined,
      columnVisibility.id ? {
        Header: 'ID',
        accessor: 'id',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'id',
            placeholder: 'Queue ID',
          }),
        filter: 'text',
        sortType: stringSort,
      } : undefined,
      columnVisibility.name ? {
        Header: 'Name',
        accessor: 'name',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'name',
            placeholder: 'My Queue',
          }),
        filter: 'text',
        sortType: stringSort,
      } : undefined,
      columnVisibility.description ? {
        Header: 'Description',
        accessor: 'description',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'description',
          }),
        filter: 'text',
        sortType: stringSort,
      } : undefined,
      columnVisibility.oldestTaskAge ? {
        Header: 'Oldest Task Age',
        accessor: 'oldestTaskAge',
        sortType: dateSort('oldestJobCreatedAt'),
      } : undefined,
      columnVisibility.pendingJobCount ? {
        Header: 'Pending Jobs',
        accessor: 'pendingJobCount',
        sortType: integerSort,
      } : undefined,
      columnVisibility.startReviewing ? {
        Header: '',
        accessor: 'startReviewing',
        canSort: false,
      } : undefined,
      columnVisibility.mutations ? {
        Header: '',
        accessor: 'mutations',
        canSort: false,
      } : undefined,
      userHasPermissions(data?.me?.permissions, [
        GQLUserPermission.EditMrtQueues,
      ]) && columnVisibility.deleteJobs
        ? {
            Header: '',
            accessor: 'deleteJobs',
            canSort: false,
          }
        : undefined,
      columnVisibility.previewJobs ? {
        Header: '',
        accessor: 'previewJobs',
        canSort: false,
      } : undefined,
    ]),
    [data?.me?.permissions, columnVisibility],
  );
  const dataValues = useMemo(
    () =>
      queues
        ? filterNullOrUndefined(queues)
            .filter((it) => it.isAppealsQueue === (selectedTab === 'APPEALS'))
            .map(
              ({ id, name, description, pendingJobCount, isDefaultQueue, oldestJobCreatedAt }) => {
                const rulesForQueue =
                  routingRules?.filter((it) => it.destinationQueue.id === id) ??
                  [];
                return {
                  id,
                  name,
                  description,
                  isFavorited: (favoriteQueues ?? []).includes(id),
                  startReviewing: startReviewing(id, pendingJobCount),
                  pendingJobCount: pendingJobCount.toLocaleString('en'),
                  oldestJobCreatedAt,
                  mutations: (
                    <RowMutations
                      canEdit={userHasPermissions(data.me?.permissions, [
                        GQLUserPermission.EditMrtQueues,
                      ])}
                      onEdit={(event) => {
                        // This ensures that the row's onClick isn't called because
                        // the row is the parent component
                        event.stopPropagation();
                        navigate(`form/${id}`);
                      }}
                      onDelete={(event) => {
                        // This ensures that the row's onClick isn't called because
                        // the row is the parent component
                        event.stopPropagation();
                        setModalInfo({
                          id,
                          visible: true,
                        });
                      }}
                      canDelete={
                        userHasPermissions(data.me?.permissions, [
                          GQLUserPermission.EditMrtQueues,
                        ]) &&
                        rulesForQueue.length === 0 &&
                        !isDefaultQueue
                      }
                      deleteDisabledTooltipTitle={
                        !userHasPermissions(data.me?.permissions, [
                          GQLUserPermission.EditMrtQueues,
                        ]) ? (
                          'You do not have permission to delete this queue. Please contact an administrator.'
                        ) : isDefaultQueue ? (
                          "This queue is your default queue, where all your jobs that don't match a Routing Rule go. You can not delete your default queue."
                        ) : rulesForQueue.length > 0 ? (
                          <div>
                            You cannot delete this queue because it is used in
                            the following routing rules:
                            <br />
                            <div className="py-1">
                              {rulesForQueue.map((rule) => (
                                <div key={rule.id} className="pl-1 font-bold">
                                  {rule.name}
                                  <br />
                                </div>
                              ))}
                            </div>
                            Click{' '}
                            <Link to="/dashboard/manual_review/routing">
                              here
                            </Link>{' '}
                            to edit your routing rules.
                          </div>
                        ) : null
                      }
                    />
                  ),
                  ...(userHasPermissions(data?.me?.permissions, [
                    GQLUserPermission.EditMrtQueues,
                  ])
                    ? {
                        deleteJobs: (
                          <Button
                            className="flex items-center justify-center w-full p-4 text-sm text-gray-600 bg-white border border-gray-200 border-solid shadow-none cursor-pointer rounded-md drop-shadow-none hover:border-gray-200 focus:border-gray-200 hover:bg-gray-100 hover:text-gray-600 focus:text-gray-600"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteAllJobsModalInfo({
                                id,
                                visible: true,
                              });
                            }}
                            disabled={pendingJobCount === 0}
                          >
                            Delete All Jobs
                          </Button>
                        ),
                      }
                    : {}),
                  ...(userHasPermissions(data?.me?.permissions, [
                    GQLUserPermission.EditMrtQueues,
                  ]) && previewJobsViewEnabled
                    ? {
                        previewJobs: (
                          <Button
                            className="flex items-center justify-center w-full p-4 text-sm text-gray-600 bg-white border border-gray-200 border-solid shadow-none cursor-pointer rounded-md drop-shadow-none hover:border-gray-200 focus:border-gray-200 hover:bg-gray-100 hover:text-gray-600 focus:text-gray-600"
                            onClick={() => navigate(`jobs/${id}`)}
                            disabled={pendingJobCount === 0}
                          >
                            Preview jobs
                          </Button>
                        ),
                      }
                    : {}),
                };
              },
            )
        : [],
    [
      data?.me?.permissions,
      favoriteQueues,
      navigate,
      queues,
      routingRules,
      selectedTab,
      startReviewing,
      previewJobsViewEnabled,
    ],
  );
  const tableData = useMemo(
    () =>
      dataValues
        ?.slice()
        ?.sort((a, b) => {
          if (a.isFavorited !== b.isFavorited) {
            return a.isFavorited ? -1 : 1;
          } else {
            return a.name.localeCompare(b.name);
          }
        })
        .map((values) => {
          return {
            favoriteQueues: (
              <div className="relative w-5 h-5">
                <div
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onRemoveFavoriteQueue(values.id);
                  }}
                >
                  <StarFilled
                    className={`cursor-pointer text-xl absolute top-0 left-0 text-coop-yellow fill-coop-yellow ${
                      values.isFavorited ? '' : 'invisible'
                    }`}
                  />
                </div>
                <Star
                  className={`cursor-pointer text-xl absolute top-0 left-0 text-coop-yellow fill-coop-yellow ${
                    values.isFavorited ? 'invisible' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onAddFavoriteQueue(values.id);
                  }}
                />
              </div>
            ),
            id: <div>{values.id}</div>,
            name: (
              <div className="ContentTypesDashboard-type-name">
                {values.name}
              </div>
            ),
            description: <div>{values.description}</div>,
            oldestTaskAge: (
              <div className={getAgeColorClass(values.oldestJobCreatedAt)}>
                {formatTimeAgo(values.oldestJobCreatedAt)}
              </div>
            ),
            pendingJobCount: <div>{values.pendingJobCount}</div>,
            startReviewing: (
              <div className="ContentTypesDashboard-type-name">
                {values.startReviewing}
              </div>
            ),
            mutations: values.mutations,
            deleteJobs: values.deleteJobs,
            previewJobs: values.previewJobs,
            values,
          };
        }),
    [dataValues, onAddFavoriteQueue, onRemoveFavoriteQueue],
  );
  if (loading) {
    return <FullScreenLoading />;
  }

  const visibleColumnsCount = Object.values(columnVisibility).filter(Boolean).length;

  // Columns button component
  const columnsButton = (
    <div ref={columnsMenuRef} className="relative inline-block text-start">
      <Button
        className={`font-semibold text-base rounded ${
          visibleColumnsCount === Object.keys(columnLabels).length
            ? 'bg-white text-gray-600 hover:bg-white hover:text-gray-600'
            : 'bg-gray-600 text-white border-none hover:bg-gray-500'
        }`}
        icon={<GridAlt className="inline-block w-4 h-4 mr-2" fill="currentColor" />}
        onClick={() => setColumnsMenuVisible(!columnsMenuVisible)}
      >
        Columns
      </Button>
      {columnsMenuVisible && (
        <div className="absolute left-0 z-20 flex flex-col mt-1 bg-white border border-solid border-gray-300 rounded shadow-md min-w-[240px]">
          <div className="px-4 py-4 text-base font-semibold">Show Columns</div>
          <div className="!p-0 !m-0 divider" />
          <div className="flex flex-col px-4 py-2">
            {(Object.keys(columnLabels) as ColumnId[])
              .filter((columnId) => {
                // Only show deleteJobs and previewJobs if user has permissions
                if (columnId === 'deleteJobs' || (columnId === 'previewJobs' && previewJobsViewEnabled)) {
                  return userHasPermissions(data?.me?.permissions, [
                    GQLUserPermission.EditMrtQueues,
                  ]);
                }
                return true;
              })
              .map((columnId) => (
                <div key={columnId} className="py-2">
                  <Checkbox
                    checked={columnVisibility[columnId]}
                    onChange={() => toggleColumnVisibility(columnId)}
                  >
                    {columnLabels[columnId]}
                  </Checkbox>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  const createButton = userHasPermissions(data?.me?.permissions, [
    GQLUserPermission.EditMrtQueues,
  ]) ? (
    <CoopButton title="Create Queue" destination="form" />
  ) : undefined;

  return (
    <div>
      <Helmet>
        <title>Manual Review Queues</title>
      </Helmet>
      <DashboardHeader
        title="Review Console"
        subtitle="Review queues allow you to manually review content and users one at a time"
        rightComponent={createButton}
      />
      {(resolvedJobsCount && resolvedJobsCount?.getResolvedJobsForUser > 0) ||
      (getSkippedJobsForUser &&
        getSkippedJobsForUser.getSkippedJobsForUser > 0) ? (
        <div className="flex flex-row">
          <div className="flex justify-between p-4 mb-4 mr-4 bg-white border border-solid rounded border-slate-200 w-96">
            <div className="flex flex-col text-start">
              <div className="pb-4 text-base font-semibold text-slate-900">
                Jobs You've Reviewed
              </div>
              <div className="flex flex-col pb-2 text-3xl font-semibold text-slate-900">
                {resolvedJobsCount?.getResolvedJobsForUser ?? 0}
              </div>
              <div className="text-sm font-medium text-slate-400">
                since yesterday
              </div>
            </div>
            <div className="pl-2 rounded">
              <TapFilled
                width={24}
                height={24}
                className={`text-xl text-sky-400 fill-sky-400`}
              />
            </div>
          </div>
          <div className="flex justify-between p-4 mb-4 bg-white border border-solid rounded border-slate-200 w-96">
            <div className="flex flex-col text-start">
              <div className="pb-4 text-base font-semibold text-slate-900">
                Jobs You've Skipped
              </div>
              <div className="flex flex-col pb-2 text-3xl font-semibold text-slate-900">
                {getSkippedJobsForUser?.getSkippedJobsForUser ?? 0}
              </div>
              <div className="text-sm font-medium text-slate-400">
                since yesterday
              </div>
            </div>
            <div className="pl-2 rounded">
              <AngleDoubleRight
                width={24}
                height={24}
                className={`text-xl text-amber-400 fill-amber-400`}
              />
            </div>
          </div>
        </div>
      ) : undefined}
      {tabs.length > 1 ? tabBar : null}
      {
        /* @ts-ignore */
        <Table columns={columns} data={tableData} topLeftComponent={columnsButton} containerClassName="w-full" />
      }
      {deleteModal}
      {deleteAllJobsModal}
    </div>
  );
}
