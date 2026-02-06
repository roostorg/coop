import { Button } from '@/coop-ui/Button';
import {
  useGQLGetUserItemsQuery,
  useGQLPoliciesQuery,
} from '@/graphql/generated';
import { filterNullOrUndefined } from '@/utils/collections';
import { getFieldValueForRole } from '@/utils/itemUtils';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '@/utils/time';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Table from '../../components/table/Table';

export default function MergedReportsComponent(props: {
  primaryReportedAt: Date | string;
  reportHistory: ReadonlyArray<{
    reportId: string;
    reportedAt: Date | string;
    policyId?: string | null;
    reason?: string | null;
    reporterId?: {
      id: string;
      typeId: string;
    } | null;
  }>;
}) {
  const { primaryReportedAt, reportHistory } = props;
  const numOtherReports = reportHistory.length - 1;
  const [collapsed, setCollapsed] = useState(true);
  const { data } = useGQLPoliciesQuery();

  const { data: reporterInfo } = useGQLGetUserItemsQuery({
    variables: {
      itemIdentifiers: filterNullOrUndefined(
        reportHistory.map((it) =>
          it.reporterId
            ? { id: it.reporterId.id, typeId: it.reporterId.typeId }
            : null,
        ),
      ),
    },
  });
  const reporterData = reporterInfo?.latestItemSubmissions;
  const reporterDisplayInfo = useMemo(
    () =>
      reporterData?.map((it) => {
        if (it.__typename !== 'UserItem') {
          return {};
        }
        const displayName = getFieldValueForRole(it, 'displayName') ?? it.id;
        return {
          id: it.id,
          typeId: it.type.id,
          displayName,
          typeName: it.type.name,
        };
      }) ?? [],
    [reporterData],
  );
  const reportHistoryWithDisplayInfo = useMemo(() => {
    return reportHistory.map((report) => {
      const displayInfo = reporterDisplayInfo.find(
        (it) =>
          it.id === report.reporterId?.id &&
          it.typeId === report.reporterId?.typeId,
      );
      return {
        ...report,
        ...(displayInfo ? { displayInfo } : {}),
      };
    });
  }, [reporterDisplayInfo, reportHistory]);

  const columns = useMemo(
    () => [
      { Header: 'Reported By', accessor: 'reportedBy' },
      { Header: 'Reported For', accessor: 'reportedFor' },
      { Header: 'Reason', accessor: 'reason' },
      { Header: 'Report Time', accessor: 'reportTime' },
    ],
    [],
  );

  const tableData = useMemo(
    () =>
      reportHistoryWithDisplayInfo
        .filter((it) => it.reportedAt !== primaryReportedAt)
        .map((report) => ({
          reportedBy: (
            <div>
              {report.displayInfo?.typeName
                ? `${report.displayInfo.typeName}: `
                : ''}
              {report.displayInfo?.displayName ?? 'Unknown'}
              <Link
                to={`/dashboard/manual_review/investigation?id=${report.reporterId?.id}&typeId=${report.reporterId?.typeId}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  className="!fill-none !p-0 !pl-1"
                  size="icon"
                  variant="link"
                  endIcon={ExternalLink}
                  aria-label="Open reporter investigation page"
                ></Button>
              </Link>
            </div>
          ),
          reportedFor: data?.myOrg?.policies.find(
            (p) => p.id === report.policyId,
          )?.name,
          reason: report.reason,
          reportTime: parseDatetimeToReadableStringInCurrentTimeZone(
            report.reportedAt,
          ),
        })),
    [data?.myOrg?.policies, primaryReportedAt, reportHistoryWithDisplayInfo],
  );

  const otherReportsTable = <Table columns={columns} data={tableData} />;
  const toggleCollapsed = useCallback(
    () => setCollapsed(!collapsed),
    [collapsed],
  );
  return (
    <div className="flex flex-col pl-4 bg-white border border-gray-200 border-solid rounded-lg">
      <div className="flex flex-row items-center justify-between text-lg">
        {numOtherReports}{' '}
        {numOtherReports === 1 ? 'other report' : 'other reports'}
        <div onClick={toggleCollapsed}>
          <Button
            variant="link"
            color="gray"
            endIcon={collapsed ? ChevronDown : ChevronUp}
          >
            {collapsed ? 'Show' : 'Hide'}
          </Button>
        </div>
      </div>
      {!collapsed && otherReportsTable}
    </div>
  );
}
