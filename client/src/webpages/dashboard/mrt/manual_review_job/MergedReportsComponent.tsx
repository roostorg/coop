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
  primaryReportId?: string | null;
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
  const { primaryReportId, reportHistory } = props;
  // The primary report is shown separately above this component. If we know
  // its reportId, exclude it from the merged list; otherwise fall back to
  // dropping the first entry (newest, which corresponds to the displayed
  // primary report after a job merge). Filtering by `reportId` is stable
  // across reports that happen to share the same `reportedAt` timestamp.
  const otherReports = useMemo(() => {
    if (primaryReportId != null) {
      const matchIdx = reportHistory.findIndex(
        (it) => it.reportId === primaryReportId,
      );
      if (matchIdx >= 0) {
        return [
          ...reportHistory.slice(0, matchIdx),
          ...reportHistory.slice(matchIdx + 1),
        ];
      }
    }
    return reportHistory.slice(1);
  }, [primaryReportId, reportHistory]);
  const numOtherReports = otherReports.length;
  const [collapsed, setCollapsed] = useState(true);
  const { data } = useGQLPoliciesQuery();

  const { data: reporterInfo } = useGQLGetUserItemsQuery({
    variables: {
      itemIdentifiers: filterNullOrUndefined(
        otherReports.map((it) =>
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
    return otherReports.map((report) => {
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
  }, [reporterDisplayInfo, otherReports]);

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
      reportHistoryWithDisplayInfo.map((report) => {
        const policy = data?.myOrg?.policies.find(
          (p) => p.id === report.policyId,
        );
        const hasReporter = report.reporterId != null;
        // Distinguish "no reporter on the report" (e.g. rule-engine, NCMEC,
        // or other system-generated enqueues) from "we couldn't resolve the
        // user item" so reviewers don't see a misleading "Unknown".
        const reportedByLabel = !hasReporter
          ? 'System'
          : report.displayInfo?.displayName ??
            report.reporterId?.id ??
            'Unknown reporter';
        const reportedByPrefix =
          hasReporter && report.displayInfo?.typeName
            ? `${report.displayInfo.typeName}: `
            : '';
        return {
          reportedBy: (
            <div>
              {reportedByPrefix}
              {reportedByLabel}
              {hasReporter && report.reporterId ? (
                <Link
                  to={`/dashboard/manual_review/investigation?id=${report.reporterId.id}&typeId=${report.reporterId.typeId}`}
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
              ) : null}
            </div>
          ),
          reportedFor: policy ? (
            <div>
              {policy.name}
              <Link
                to={`/dashboard/policies/form/${policy.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  className="!fill-none !p-0 !pl-1"
                  size="icon"
                  variant="link"
                  endIcon={ExternalLink}
                  aria-label={`Open policy ${policy.name}`}
                ></Button>
              </Link>
            </div>
          ) : (
            '—'
          ),
          reason: report.reason?.trim() ? report.reason : '—',
          reportTime: parseDatetimeToReadableStringInCurrentTimeZone(
            report.reportedAt,
          ),
        };
      }),
    [data?.myOrg?.policies, reportHistoryWithDisplayInfo],
  );

  const otherReportsTable = (
    <Table columns={columns} data={tableData} containerClassName="w-full" />
  );
  const toggleCollapsed = useCallback(
    () => setCollapsed(!collapsed),
    [collapsed],
  );
  return (
    <div className="flex flex-col w-full p-4 bg-white border border-gray-200 border-solid rounded-lg">
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
