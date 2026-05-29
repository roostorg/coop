import { Button } from '@/coop-ui/Button';
import {
  GQLGetDecidedJobQuery,
  GQLItemType,
  GQLNcmecFileAnnotation,
  GQLNcmecIndustryClassification,
  GQLSchemaFieldRoles,
  GQLUserPermission,
  useGQLGetMoreInfoForItemsQuery,
  useGQLGetUserItemsQuery,
} from '@/graphql/generated';
import { userHasPermissions } from '@/routing/permissions';
import { filterNullOrUndefined } from '@/utils/collections';
import { getFieldValueForRole } from '@/utils/itemUtils';
import { selectPreferredUserItem } from '@/utils/manualReviewTool';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import CopyTextComponent from '@/components/common/CopyTextComponent';

import InvalidateReportsButton from './InvalidateReportsButton';
import { ManualReviewJobPayload } from './ManualReviewJobReview';
import ManualReviewJobCommentSection from './v2/ManualReviewJobCommentSection';

export default function ReportInfoComponent(props: {
  reportPayload: ManualReviewJobPayload;
  policyIds: readonly string[];
  isAppeal: boolean;
  closedJobData?: {
    closedJob: GQLGetDecidedJobQuery['getDecidedJob'];
    ncmecDecisions?: readonly {
      readonly id: string;
      readonly typeId: string;
      readonly url: string;
      readonly fileAnnotations: readonly GQLNcmecFileAnnotation[];
      readonly industryClassification: GQLNcmecIndustryClassification;
    }[];
    rightComponent?: React.ReactNode;
  };
  createdAt: string | Date;
  numTimesReported?: number;
  jobId: string;
  userId: string;
  actionsTaken?: string[];
  orgId: string;
  allItemTypes: GQLItemType[];
  policies: readonly { id: string; name: string }[];
  viewerPermissions?: readonly GQLUserPermission[];
  onInvalidated?: () => Promise<void> | void;
}) {
  const {
    reportPayload: payload,
    policyIds,
    closedJobData,
    isAppeal,
    createdAt,
    numTimesReported,
    jobId,
    userId,
    allItemTypes,
    actionsTaken,
    policies,
    viewerPermissions,
    onInvalidated,
  } = props;
  const canInvalidateReports =
    !isAppeal &&
    userHasPermissions(viewerPermissions, [GQLUserPermission.EditMrtQueues]);
  const reportedItem = payload.item;
  const reportedForReasons =
    payload.__typename === 'UserManualReviewJobPayload' ||
    payload.__typename === 'ContentManualReviewJobPayload' ||
    payload.__typename === 'ThreadManualReviewJobPayload'
      ? (payload.reportedForReasons ?? [])
      : [];
  // TODO: we really should add reportDate into this payload instead
  // of relying on the implicit ordering
  const latestReporterIdentifier =
    reportedForReasons[reportedForReasons.length - 1]?.reporterId ?? undefined;
  const latestReportReason = reportedForReasons[reportedForReasons.length - 1];

  const getItemTypeName = useCallback(
    (itemTypeId: string) =>
      allItemTypes.find((itemType) => itemType.id === itemTypeId)?.name ??
      'Unknown',
    [allItemTypes],
  );
  const { data: reporterData } = useGQLGetMoreInfoForItemsQuery({
    variables: {
      ids: [
        ...filterNullOrUndefined([
          latestReporterIdentifier
            ? {
                id: latestReporterIdentifier.id,
                typeId: latestReporterIdentifier.typeId,
              }
            : null,
        ]),
      ],
    },
  });
  const { data: reporterItemInvestigationData } = useGQLGetUserItemsQuery({
    variables: {
      itemIdentifiers: [
        ...filterNullOrUndefined([
          latestReporterIdentifier
            ? {
                id: latestReporterIdentifier.id,
                typeId: latestReporterIdentifier.typeId,
              }
            : null,
        ]),
      ],
    },
  });

  const reporterInfo = selectPreferredUserItem(
    reporterData?.partialItems.__typename === 'PartialItemsSuccessResponse'
      ? reporterData.partialItems.items
      : undefined,
    reporterItemInvestigationData?.latestItemSubmissions,
  );
  const reporterDisplayName = reporterInfo
    ? (getFieldValueForRole<GQLSchemaFieldRoles, keyof GQLSchemaFieldRoles>(
        reporterInfo,
        'displayName',
      ) ?? reporterInfo.id)
    : latestReporterIdentifier?.id;

  return (
    (('reportedForReason' in payload && payload.reportedForReason) ||
      policyIds.length > 0 ||
      payload.enqueueSourceInfo) && (
      <>
        <div
          className={`flex flex-row items-center justify-between ${
            closedJobData?.rightComponent ? 'pt-4' : ''
          }`}
        >
          <div className="text-lg font-bold">
            {isAppeal ? 'Appeal' : 'Report'}
          </div>
          {closedJobData?.rightComponent}
        </div>
        <div className="my-2 divider" />
        <div className="flex flex-col items-start justify-between p-4 mt-2 mb-8 bg-white border border-gray-200 border-solid rounded-lg">
          <table>
            <tbody>
              <tr>
                <th className="py-1 pr-2 font-bold align-top text-start whitespace-nowrap">
                  {isAppeal ? 'Appeal ' : 'Report '}Received
                </th>
                <td className="py-1 align-top text-start text-slate-500">
                  {format(new Date(createdAt as string), 'MM/dd/yy hh:mm a')}
                </td>
              </tr>
              <tr>
                <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                  {isAppeal ? 'Actioned ' : 'Reported '}Item
                </th>
                <td className="py-1 align-top text-start text-slate-500">
                  <div className="flex flex-wrap gap-x-2 gap-y-0 break-all">
                    <span className="whitespace-nowrap">
                      {reportedItem.type.name}:
                    </span>
                    <CopyTextComponent
                      value={reportedItem.id}
                      displayValue={reportedItem.id}
                      wrapText
                    />
                  </div>
                </td>
              </tr>
              {payload.enqueueSourceInfo && (
                <tr>
                  <th className="py-1 pr-4 font-bold align-top text-start whitespace-nowrap">
                    {isAppeal ? 'Appeal Created By' : 'Report Created By'}
                  </th>
                  <td className="py-1 align-top text-start text-slate-500">
                    {(() => {
                      const { enqueueSourceInfo } = payload;
                      switch (enqueueSourceInfo.__typename) {
                        case 'MrtJobEnqueueSourceInfo':
                          return 'Rerouting from different queue';
                        case 'ReportEnqueueSourceInfo':
                          if (latestReporterIdentifier) {
                            const typeName = getItemTypeName(
                              latestReporterIdentifier.typeId,
                            );
                            return (
                              <div className="flex flex-wrap items-center gap-x-2">
                                <span>
                                  {`${typeName}: `}
                                  {reporterDisplayName ??
                                    latestReporterIdentifier.id}
                                </span>
                                <Link
                                  to={`/dashboard/manual_review/investigation/?id=${latestReporterIdentifier.id}&typeId=${latestReporterIdentifier.typeId}`}
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
                                {canInvalidateReports && (
                                  <InvalidateReportsButton
                                    reporter={{
                                      id: latestReporterIdentifier.id,
                                      typeId: latestReporterIdentifier.typeId,
                                    }}
                                    reporterDisplayName={
                                      typeof reporterDisplayName === 'string'
                                        ? reporterDisplayName
                                        : undefined
                                    }
                                    jobId={jobId}
                                    onInvalidated={onInvalidated}
                                  />
                                )}
                              </div>
                            );
                          }
                          return 'Report API';
                        case 'AppealEnqueueSourceInfo':
                          return 'Appeal API';
                        case 'RuleExecutionEnqueueSourceInfo':
                          return `Rule${
                            enqueueSourceInfo.rules.length > 1 ? 's' : ''
                          }: ${enqueueSourceInfo.rules
                            .map((it) => it.name)
                            .join(', ')}`;
                        case 'PostActionsEnqueueSourceInfo':
                          return 'Actions Endpoint';
                      }
                    })()}
                  </td>
                </tr>
              )}
              {'reportedForReasons' in payload &&
                payload.reportedForReasons &&
                latestReportReason &&
                latestReportReason.reason && (
                  <tr>
                    <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                      Reason
                    </th>
                    <td className="py-1 align-top text-start text-slate-500">
                      {latestReportReason.reason}
                    </td>
                  </tr>
                )}
              {'appealReason' in payload && payload.appealReason && (
                <tr>
                  <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                    Reason for Appeal
                  </th>
                  <td className="py-1 align-top text-start text-slate-500">
                    {payload.appealReason}
                  </td>
                </tr>
              )}
              {actionsTaken && actionsTaken.length && (
                <tr>
                  <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                    Actions Taken
                  </th>
                  <td className="py-1 align-top text-start text-slate-500">
                    {actionsTaken.join(', ')}
                  </td>
                </tr>
              )}
              {policyIds.length > 0 && policies.length > 0 && (
                <tr>
                  <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                    Reported For
                  </th>
                  <td className="py-1 align-top text-start text-slate-500">
                    {policies
                      .filter((it) => policyIds.includes(it.id))
                      .map((it) => it.name)
                      .join(', ')}
                  </td>
                </tr>
              )}
              {numTimesReported != null ? (
                <tr>
                  <th className="py-1 mr-4 font-bold align-top text-start whitespace-nowrap">
                    Report Count
                  </th>
                  <td>
                    <div className="py-1 align-top text-start text-slate-500">
                      {numTimesReported !== 1
                        ? `This ${reportedItem.type.name} has been reported ${numTimesReported} times`
                        : `This ${reportedItem.type.name} has been reported 1 time`}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="w-full h-px my-2 bg-slate-200" />
          <ManualReviewJobCommentSection jobId={jobId} userId={userId} />
        </div>
      </>
    )
  );
}
