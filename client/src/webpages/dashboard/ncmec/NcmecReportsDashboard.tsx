import { toast } from '@/coop-ui/Toast';
import {
  GQLUserPermission,
  useGQLAllNcmecReportsQuery,
  useGQLGetNcmecReportLazyQuery,
  useGQLPermissionsQuery,
  useGQLRetryNcmecSubmissionMutation,
} from '@/graphql/generated';
import GridAlt from '@/icons/lnif/Design/grid-alt.svg?react';
import { userHasPermissions } from '@/routing/permissions';
import { filterNullOrUndefined } from '@/utils/collections';
import { AuditOutlined, DownloadOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Checkbox, Input, Tag, Tooltip } from 'antd';
import { format } from 'date-fns';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import CopyTextComponent from '../../../components/common/CopyTextComponent';
import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import DashboardHeader from '../components/DashboardHeader';
import {
  ColumnProps,
  DateRangeColumnFilter,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../components/table/filters';
import { stringSort } from '../components/table/sort';
import Table from '../components/table/Table';

/** Anchor that lazily creates a Blob URL on click and revokes it shortly
 * after the download is triggered. Avoids leaking Blob URLs on every render
 * (the previous inline `URL.createObjectURL` pattern leaked one per row per
 * re-render, which adds up on a long-lived dashboard). */
function BlobDownloadLink(props: {
  fileName: string;
  contents: string;
  mimeType: string;
  children: ReactNode;
  className?: string;
}) {
  const { fileName, contents, mimeType, children, className } = props;
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after the browser has had a chance to start the download.
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [contents, fileName, mimeType],
  );
  return (
    <a href="#" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

gql`
  fragment NCMECReportValues on NCMECReport {
    ts
    reportId
    userId
    userItemType {
      name
    }
    reportedMedia {
      id
      xml
    }
    additionalFiles {
      url
      xml
      ncmecFileId
    }
    reviewerId
    reportXml
    reportedMessages {
      fileName
      csv
      ncmecFileId
    }
    isTest
  }

  fragment NcmecFailedSubmissionValues on NcmecFailedSubmission {
    decisionId
    ts
    reviewerId
    userId
    userItemType {
      name
    }
    status
    retryCount
    lastError
  }

  query AllNCMECReports {
    myOrg {
      hasNCMECReportingEnabled
      ncmecReports {
        ...NCMECReportValues
      }
      failedNcmecSubmissions {
        ...NcmecFailedSubmissionValues
      }
      users {
        id
        firstName
        lastName
      }
    }
  }

  query Permissions {
    me {
      permissions
    }
  }

  query GetNCMECReport($reportId: ID!) {
    ncmecReportById(reportId: $reportId) {
      ...NCMECReportValues
    }
  }

  mutation RetryNcmecSubmission($decisionId: ID!) {
    retryNcmecSubmission(decisionId: $decisionId) {
      success
      error
    }
  }
`;

type ColumnId =
  | 'date'
  | 'reviewer'
  | 'reportId'
  | 'userId'
  | 'userItemType'
  | 'status'
  | 'reportedMedia'
  | 'additionalFiles'
  | 'reportedMessages'
  | 'isTest'
  | 'lastError'
  | 'action';

const COLUMN_VISIBILITY_STORAGE_KEY = 'ncmec-reports-column-visibility';

const defaultColumnVisibility: Record<ColumnId, boolean> = {
  date: true,
  reviewer: true,
  reportId: true,
  userId: true,
  userItemType: true,
  status: true,
  reportedMedia: true,
  additionalFiles: true,
  reportedMessages: true,
  isTest: true,
  lastError: false,
  action: true,
};

const columnLabels: Record<ColumnId, string> = {
  date: 'Date',
  reviewer: 'Reviewer',
  reportId: 'Report ID',
  userId: 'User ID',
  userItemType: 'User Item Type',
  status: 'Status',
  reportedMedia: 'Reported Media',
  additionalFiles: 'Additional Files',
  reportedMessages: 'Reported Messages',
  isTest: 'Test Report',
  lastError: 'Last Error',
  action: 'Action',
};

export default function NcmecReportsDashboard() {
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState<string | undefined>(undefined);
  const { data: permissionsData, loading: permissionsLoading } =
    useGQLPermissionsQuery();

  const {
    loading: allReportsLoading,
    error: allReportsError,
    data: allReportsData,
  } = useGQLAllNcmecReportsQuery();
  const {
    hasNCMECReportingEnabled,
    ncmecReports,
    failedNcmecSubmissions,
    users,
  } = allReportsData?.myOrg ?? {};

  const [
    getNcmecReportById,
    {
      loading: ncmecReportLoading,
      error: ncmecReportError,
      data: ncmecReportData,
    },
  ] = useGQLGetNcmecReportLazyQuery();

  const [retryNcmecSubmission] = useGQLRetryNcmecSubmissionMutation();
  const [retryingDecisionId, setRetryingDecisionId] = useState<string | null>(
    null,
  );

  const handleRetry = useCallback(
    async (decisionId: string) => {
      setRetryingDecisionId(decisionId);
      try {
        const { data } = await retryNcmecSubmission({
          variables: { decisionId },
          // Refetching keeps the table consistent: a successful retry should
          // move the row from "Failed" to "Successful" the next render.
          refetchQueries: ['AllNCMECReports'],
          awaitRefetchQueries: true,
        });
        if (data?.retryNcmecSubmission.success) {
          toast.success('NCMEC submission retried successfully');
        } else {
          toast.error(
            data?.retryNcmecSubmission.error ??
              'Retry failed for an unknown reason',
          );
        }
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : 'Retry failed unexpectedly',
        );
      } finally {
        setRetryingDecisionId(null);
      }
    },
    [retryNcmecSubmission],
  );

  // Column visibility state, persisted to localStorage so users keep their
  // chosen view across sessions. Mirrors the queues-dashboard pattern.
  const [columnVisibility, setColumnVisibility] = useState<
    Record<ColumnId, boolean>
  >(() => {
    try {
      const stored = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (stored) {
        return {
          ...defaultColumnVisibility,
          ...(JSON.parse(stored) as Partial<Record<ColumnId, boolean>>),
        };
      }
    } catch {
      // Ignore corrupt or inaccessible localStorage entries; fall through to
      // the defaults rather than blocking the whole page.
    }
    return defaultColumnVisibility;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        COLUMN_VISIBILITY_STORAGE_KEY,
        JSON.stringify(columnVisibility),
      );
    } catch {
      // Best-effort persistence; quota / private-mode failures are non-fatal.
    }
  }, [columnVisibility]);

  const toggleColumnVisibility = useCallback((columnId: ColumnId) => {
    setColumnVisibility((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  }, []);

  const [columnsMenuVisible, setColumnsMenuVisible] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

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
    return undefined;
  }, [columnsMenuVisible]);

  const fetchReportById = () => {
    if (!searchId) {
      return;
    }
    getNcmecReportById({ variables: { reportId: searchId } });
  };

  const columns = useMemo(
    () =>
      filterNullOrUndefined([
        columnVisibility.date
          ? {
              Header: 'Date',
              accessor: 'date',
              sortType: stringSort,
              sortDescFirst: true,
              Filter: (props: ColumnProps) =>
                DateRangeColumnFilter({
                  columnProps: props,
                  accessor: 'date',
                  placeholder: '',
                }),
              filter: 'dateRange',
            }
          : undefined,
        columnVisibility.reviewer
          ? {
              Header: 'Reviewer',
              accessor: 'reviewer',
              filter: 'includes',
              sortType: stringSort,
              Filter: (props: ColumnProps) =>
                SelectColumnFilter({
                  columnProps: props,
                  accessor: 'reviewer',
                }),
            }
          : undefined,
        columnVisibility.status
          ? {
              // Cell renders the colored Tag from row.status; the filter
              // reads the plain string from row.original.values.status.
              Header: 'Status',
              accessor: 'status',
              filter: 'includes',
              sortType: stringSort,
              Filter: (props: ColumnProps) =>
                SelectColumnFilter({
                  columnProps: props,
                  accessor: 'status',
                }),
            }
          : undefined,
        columnVisibility.reportId
          ? {
              Header: 'Report ID',
              accessor: 'reportId',
              filter: 'text',
              canSort: false,
              Filter: (props: ColumnProps) =>
                DefaultColumnFilter({
                  columnProps: props,
                  accessor: 'reportId',
                  placeholder: 'Report ID',
                }),
            }
          : undefined,
        columnVisibility.userId
          ? {
              Header: 'User ID',
              accessor: 'userId',
              filter: 'text',
              canSort: false,
              Filter: (props: ColumnProps) =>
                DefaultColumnFilter({
                  columnProps: props,
                  accessor: 'userId',
                  placeholder: 'User ID',
                }),
            }
          : undefined,
        columnVisibility.userItemType
          ? {
              Header: 'User Item Type',
              accessor: 'userItemType',
              filter: 'text',
              canSort: false,
              Filter: (props: ColumnProps) =>
                DefaultColumnFilter({
                  columnProps: props,
                  accessor: 'userItemType',
                  placeholder: 'User Type',
                }),
            }
          : undefined,
        columnVisibility.reportedMedia
          ? { Header: 'Reported Media', accessor: 'reportedMedia' }
          : undefined,
        columnVisibility.additionalFiles
          ? { Header: 'Additional Files', accessor: 'additionalFiles' }
          : undefined,
        columnVisibility.reportedMessages
          ? { Header: 'Reported Messages', accessor: 'reportedMessages' }
          : undefined,
        columnVisibility.isTest
          ? { Header: 'Test Report', accessor: 'isTest' }
          : undefined,
        columnVisibility.lastError
          ? { Header: 'Last Error', accessor: 'lastError' }
          : undefined,
        columnVisibility.action
          ? { Header: 'Action', accessor: 'action' }
          : undefined,
      ]),
    [columnVisibility],
  );

  const tableData = useMemo(() => {
    // Successful reports come from `ncmecReports`; if the user is searching by
    // a specific report id we substitute the lazy-fetched single report — but
    // only when that fetched report actually matches the current `searchId`,
    // otherwise editing the input after a fetch would show stale data.
    const successfulReportsSource =
      searchId && ncmecReportData?.ncmecReportById?.reportId === searchId
        ? [ncmecReportData.ncmecReportById]
        : (ncmecReports ?? []);

    const successfulRows = successfulReportsSource
      .filter((report) =>
        searchId ? report.reportId.includes(searchId) : true,
      )
      .map((report) => {
        const reviewer = users?.find((u) => u.id === report.reviewerId);
        const reviewerName = reviewer
          ? `${reviewer.firstName} ${reviewer.lastName}`
          : 'Other';
        return {
          // Sort key: numeric ms since epoch on the underlying timestamp.
          tsMs: new Date(report.ts).getTime(),
          row: {
            // `date` is `YYYY-MM-DD` for the dateRange comparator.
            values: {
              date: format(new Date(report.ts), 'yyyy-MM-dd'),
              reviewer: reviewerName,
              status: 'Successful' as const,
              reportId: report.reportId,
              userId: report.userId,
              userItemType: report.userItemType.name,
            },
            date: <div>{format(new Date(report.ts), 'MM/dd/yy h:mm a')}</div>,
            reviewer: <div className="whitespace-nowrap">{reviewerName}</div>,
            status: <Tag color="success">Successful</Tag>,
            reportId: (
              <div key={report.reportId} className="flex flex-row">
                <CopyTextComponent value={report.reportId} />
                <div className="pl-2">
                  <BlobDownloadLink
                    fileName={`ncmec_report_${report.reportId}.xml`}
                    contents={formatXml(report.reportXml)}
                    mimeType="text/plain"
                  >
                    <DownloadOutlined />
                  </BlobDownloadLink>
                </div>
              </div>
            ),
            userId: <CopyTextComponent value={report.userId} />,
            userItemType: <div>{report.userItemType.name}</div>,
            reportedMedia: (
              <div className="flex flex-col justify-start gap-1 text-start">
                {report.reportedMedia.length < 2
                  ? null
                  : `${report.reportedMedia.length} media files: `}
                <div className="flex flex-wrap overflow-auto max-h-12">
                  {report.reportedMedia.map((media) => (
                    <div key={media.id} className="flex flex-row">
                      <CopyTextComponent value={`ID: ${media.id}`} />
                      <div className="pl-2">
                        <BlobDownloadLink
                          fileName={`ncmec_report_${report.reportId}_media_${media.id}.xml`}
                          contents={formatXml(media.xml)}
                          mimeType="text/plain"
                        >
                          <DownloadOutlined />
                        </BlobDownloadLink>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            additionalFiles: (
              <div className="flex flex-col justify-start max-w-md gap-1 text-start">
                {report.additionalFiles.length < 2
                  ? null
                  : `${report.additionalFiles.length} additional files: `}
                <div className="flex flex-wrap overflow-auto max-h-12">
                  {report.additionalFiles.map((additionalFile) => (
                    <div
                      key={additionalFile.ncmecFileId}
                      className="flex flex-row"
                    >
                      <div className="pl-2">
                        <BlobDownloadLink
                          fileName={`ncmec_report_additional_file_${additionalFile.ncmecFileId}.xml`}
                          contents={formatXml(additionalFile.xml)}
                          mimeType="text/plain"
                        >
                          <DownloadOutlined className="pr-1" />
                        </BlobDownloadLink>
                      </div>
                      <div className="overflow-ellipsis">
                        {`URL: ${additionalFile.url}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            reportedMessages: (
              <div className="flex flex-col justify-start gap-1 text-start">
                {report.reportedMessages.length < 2
                  ? null
                  : `${report.reportedMessages.length} reported threads: `}
                <div className="flex flex-wrap overflow-auto max-h-12">
                  {report.reportedMessages.map((reportedMessage) => (
                    <div
                      key={reportedMessage.fileName}
                      className="flex flex-row"
                    >
                      {`${reportedMessage.fileName}`}
                      <div className="pl-2">
                        <BlobDownloadLink
                          fileName={reportedMessage.fileName}
                          contents={reportedMessage.csv}
                          mimeType="text/csv"
                        >
                          <DownloadOutlined />
                        </BlobDownloadLink>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            isTest: <div>{report.isTest ? 'True' : 'False'}</div>,
            lastError: null as ReactNode,
            action: null as ReactNode,
          },
        };
      });

    // Failed rows: only included when the user isn't searching by report id
    // (failed submissions don't have a CyberTip report id to match against).
    const failedRows = searchId
      ? []
      : (failedNcmecSubmissions ?? []).map((failed) => {
          const reviewer = users?.find((u) => u.id === failed.reviewerId);
          const reviewerName = reviewer
            ? `${reviewer.firstName} ${reviewer.lastName}`
            : 'Other';
          return {
            tsMs: new Date(failed.ts).getTime(),
            row: {
              // `reportId` is empty: failed submissions have no CyberTip id,
              // so the text filter treats them as non-matching when used.
              values: {
                date: format(new Date(failed.ts), 'yyyy-MM-dd'),
                reviewer: reviewerName,
                status: 'Failed' as const,
                reportId: '',
                userId: failed.userId,
                userItemType: failed.userItemType.name,
              },
              date: <div>{format(new Date(failed.ts), 'MM/dd/yy h:mm a')}</div>,
              reviewer: <div className="whitespace-nowrap">{reviewerName}</div>,
              status: <Tag color="error">Failed</Tag>,
              reportId: <span className="text-zinc-400">—</span>,
              userId: <CopyTextComponent value={failed.userId} />,
              userItemType: <div>{failed.userItemType.name}</div>,
              reportedMedia: <span className="text-zinc-400">—</span>,
              additionalFiles: <span className="text-zinc-400">—</span>,
              reportedMessages: <span className="text-zinc-400">—</span>,
              isTest: <span className="text-zinc-400">—</span>,
              lastError: failed.lastError ? (
                <Tooltip title={failed.lastError} placement="topLeft">
                  <div className="max-w-xs overflow-hidden text-xs text-ellipsis whitespace-nowrap text-red-700">
                    {failed.lastError}
                  </div>
                </Tooltip>
              ) : (
                <span className="text-zinc-400">—</span>
              ),
              action: (
                <Button
                  size="small"
                  type="primary"
                  loading={retryingDecisionId === failed.decisionId}
                  disabled={
                    retryingDecisionId !== null &&
                    retryingDecisionId !== failed.decisionId
                  }
                  onClick={() => {
                    void handleRetry(failed.decisionId);
                  }}
                >
                  Retry
                </Button>
              ),
            },
          };
        });

    return [...successfulRows, ...failedRows]
      .sort((a, b) => b.tsMs - a.tsMs)
      .map(({ row }) => row);
  }, [
    failedNcmecSubmissions,
    handleRetry,
    ncmecReportData,
    ncmecReports,
    retryingDecisionId,
    searchId,
    users,
  ]);

  if (allReportsError || ncmecReportError) {
    throw allReportsError ?? ncmecReportError!;
  }

  if (permissionsLoading) {
    return <FullScreenLoading />;
  }

  const canSeeNCMECReports = userHasPermissions(
    permissionsData?.me?.permissions,
    [GQLUserPermission.ViewChildSafetyData],
  );
  if (
    (hasNCMECReportingEnabled != null && !hasNCMECReportingEnabled) ||
    !canSeeNCMECReports
  ) {
    navigate('/dashboard/manual_review');
  }

  return (
    <>
      <Helmet>
        <title>NCMEC Reports</title>
      </Helmet>
      <DashboardHeader
        title="NCMEC Reports"
        subtitle="View all NCMEC reports submitted by your organization."
      />
      {allReportsLoading || ncmecReportLoading ? (
        <FullScreenLoading />
      ) : (ncmecReports?.length ?? 0) === 0 &&
        (failedNcmecSubmissions?.length ?? 0) === 0 ? (
        <div className="flex items-center justify-center w-full h-full">
          <div className="flex flex-col items-center justify-center p-12 mt-24">
            <div className="pb-3 text-zinc-500 text-8xl">
              {<AuditOutlined />}
            </div>
            <div className="pb-2 text-3xl text-zinc-500 max-w-100">
              No NCMEC Reports
            </div>
            <div className="pt-2 pb-10 text-base max-w-100 text-zinc-500">
              There are no NCMEC reports to display. Click here to return to the
              Manual Review Tool.
            </div>
            <CoopButton
              onClick={() => navigate('/dashboard/manual_review/queues')}
              title="Back to Manual Review"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 max-w-full">
          <Table
            // Override Table's default `w-fit` so its internal overflow-x-auto
            // can scroll the table when columns overflow the viewport, and
            // force the horizontal scrollbar to render.
            containerClassName="w-full min-w-0"
            alwaysShowScrollbar
            columns={columns}
            data={tableData ?? []}
            topLeftComponent={
              <div
                className="flex flex-row flex-wrap items-end gap-4"
                key="topleft"
              >
                <div className="flex flex-col items-start">
                  <div className="mb-2 font-semibold">Search By Report ID</div>
                  <Input
                    className="rounded-lg w-[300px]"
                    onChange={(event) => setSearchId(event.target.value)}
                    autoFocus
                    allowClear
                  />
                </div>
                <div
                  ref={columnsMenuRef}
                  className="relative inline-block text-start"
                >
                  <Button
                    className={`font-semibold text-base rounded ${
                      Object.values(columnVisibility).filter(Boolean).length ===
                      Object.keys(columnLabels).length
                        ? 'bg-white text-gray-600 hover:bg-white hover:text-gray-600'
                        : 'bg-gray-600 text-white border-none hover:bg-gray-500'
                    }`}
                    icon={
                      <GridAlt
                        className="inline-block w-4 h-4 mr-2"
                        fill="currentColor"
                      />
                    }
                    onClick={() => setColumnsMenuVisible(!columnsMenuVisible)}
                  >
                    Columns
                  </Button>
                  {columnsMenuVisible && (
                    <div className="absolute left-0 z-20 flex flex-col mt-1 bg-white border border-solid border-gray-300 rounded shadow-md min-w-[240px]">
                      <div className="px-4 py-4 text-base font-semibold">
                        Show Columns
                      </div>
                      <div className="!p-0 !m-0 divider" />
                      <div className="flex flex-col px-4 py-2">
                        {(Object.keys(columnLabels) as ColumnId[]).map(
                          (columnId) => (
                            <div key={columnId} className="py-2">
                              <Checkbox
                                checked={columnVisibility[columnId]}
                                onChange={() =>
                                  toggleColumnVisibility(columnId)
                                }
                              >
                                {columnLabels[columnId]}
                              </Checkbox>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            }
          />
          {searchId && tableData?.length === 0 ? (
            <div className="flex items-center self-center justify-center h-full p-8 mt-8 text-base text-center rounded shadow w-fit bg-slate-100 text-slate-600">
              Don't see the report?{' '}
              <Button type="link" onClick={fetchReportById}>
                Click here to search further back
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

// Stolen from https://stackoverflow.com/a/49458964
function formatXml(xml: string) {
  let formatted = '';
  let indent = '';
  const tab = '\t';
  xml.split(/>\s*</).forEach(function (node) {
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length);
    }
    formatted += indent + '<' + node + '>\r\n';
    if (node.match(/^<?\w[^>]*[^/]$/)) indent += tab;
  });
  return formatted.substring(1, formatted.length - 3);
}
