import { AuditOutlined, DownloadOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Input } from 'antd';
import moment from 'moment';
import { useMemo, useState } from 'react';
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

import {
  GQLUserPermission,
  useGQLAllNcmecReportsQuery,
  useGQLGetNcmecReportLazyQuery,
  useGQLPermissionsQuery,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';

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

  query AllNCMECReports {
    myOrg {
      hasNCMECReportingEnabled
      ncmecReports {
        ...NCMECReportValues
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
`;

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
  const { hasNCMECReportingEnabled, ncmecReports, users } =
    allReportsData?.myOrg ?? {};

  const [
    getNcmecReportById,
    {
      loading: ncmecReportLoading,
      error: ncmecReportError,
      data: ncmecReportData,
    },
  ] = useGQLGetNcmecReportLazyQuery();

  const fetchReportById = () => {
    if (!searchId) {
      return;
    }
    getNcmecReportById({ variables: { reportId: searchId } });
  };

  const columns = useMemo(
    () => [
      {
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
      },
      {
        Header: 'Reviewer',
        accessor: 'reviewer',
        filter: 'includes',
        sortType: stringSort,
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'reviewer',
          }),
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
        Header: 'Reported Media',
        accessor: 'reportedMedia',
      },
      {
        Header: 'Additional Files',
        accessor: 'additionalFiles',
      },
      {
        Header: 'Reported Messages',
        accessor: 'reportedMessages',
      },
      {
        Header: 'Test Report',
        accessor: 'isTest',
      },
    ],
    [],
  );

  const dataValues = useMemo(() => {
    const reports =
      searchId && ncmecReportData && ncmecReportData.ncmecReportById
        ? [ncmecReportData.ncmecReportById]
        : ncmecReports;
    return reports
      ?.filter((report) =>
        searchId ? report.reportId.includes(searchId) : true,
      )
      .sort((a, b) =>
        b.ts.toLocaleString().localeCompare(a.ts.toLocaleString()),
      )
      .map((report) => {
        const reviewer = users?.find((user) => user.id === report.reviewerId);
        return {
          ...report,
          date: report.ts,
          reviewer: reviewer
            ? `${reviewer.firstName} ${reviewer.lastName}`
            : 'Other',
        };
      });
  }, [ncmecReportData, ncmecReports, searchId, users]);

  const tableData = useMemo(
    () =>
      dataValues?.map((report) => {
        return {
          date: (
            <div>{moment(report.date).local().format('MM/DD/YY h:mm a')}</div>
          ),
          reviewer: <div className="whitespace-nowrap">{report.reviewer}</div>,
          reportId: (
            <div key={report.reportId} className="flex flex-row">
              <CopyTextComponent value={report.reportId} />
              <div className="pl-2">
                <a
                  href={URL.createObjectURL(
                    new Blob([formatXml(report.reportXml)], {
                      type: 'text/plain',
                    }),
                  )}
                  download={`ncmec_report_${report.reportId}.xml`}
                >
                  <DownloadOutlined />
                </a>
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
                      <a
                        href={URL.createObjectURL(
                          new Blob([formatXml(media.xml)], {
                            type: 'text/plain',
                          }),
                        )}
                        download={`ncmec_report_${report.reportId}_media_${media.id}.xml`}
                      >
                        <DownloadOutlined />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
          values: report,
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
                      <a
                        href={URL.createObjectURL(
                          new Blob([formatXml(additionalFile.xml)], {
                            type: 'text/plain',
                          }),
                        )}
                        download={`ncmec_report_additional_file_${additionalFile.ncmecFileId}.xml`}
                      >
                        <DownloadOutlined className="pr-1" />
                      </a>
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
                  <div key={reportedMessage.fileName} className="flex flex-row">
                    {`${reportedMessage.fileName}`}
                    <div className="pl-2">
                      <a
                        href={URL.createObjectURL(
                          new Blob([reportedMessage.csv], {
                            type: 'text/csv',
                          }),
                        )}
                        download={`${reportedMessage.fileName}`}
                      >
                        <DownloadOutlined />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
          isTest: <div>{report.isTest ? 'True' : 'False'}</div>,
        };
      }),
    [dataValues],
  );

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
      ) : ncmecReports?.length === 0 ? (
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
        <div className="flex flex-col max-w-full w-fit">
          <Table
            columns={columns}
            data={tableData ?? []}
            topLeftComponent={
              <div className="flex flex-col items-start" key="input">
                <div className="mb-2 font-semibold">Search By Report ID</div>
                <Input
                  className="rounded-lg w-[300px]"
                  onChange={(event) => setSearchId(event.target.value)}
                  autoFocus
                  allowClear
                />
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
