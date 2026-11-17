import { toast } from '@/coop-ui/Toast';
import { gql, useApolloClient } from '@apollo/client';
import { Select, Tag, Tooltip } from 'antd';

import CoopButton from '../components/CoopButton';

import {
  GQLIntegrationCatalogRefreshInterval,
  GQLIntegrationCatalogRefreshStatus,
  useGQLRefreshIntegrationCatalogMutation,
  type GQLIntegrationConfigQuery,
} from '../../../graphql/generated';
import { safeFormatDistanceToNow } from '../../../utils/time';
import { evictOrgSignals } from './integrationCatalogCache';

gql`
  mutation RefreshIntegrationCatalog($integrationId: String!) {
    refreshIntegrationCatalog(integrationId: $integrationId) {
      ... on RefreshIntegrationCatalogSuccessResponse {
        integrationId
        version
        signalCount
        fetchedAt
        addedSignalTypeIds
        removedSignalTypeIds
      }
      ... on IntegrationCatalogRefreshError {
        title
        detail
      }
      ... on IntegrationConfigUnsupportedIntegrationError {
        title
      }
    }
  }
`;

type IntegrationCatalogStatus = NonNullable<
  NonNullable<
    Extract<
      GQLIntegrationConfigQuery['integrationConfig'],
      { __typename: 'IntegrationConfigSuccessResult' }
    >['config']
  >['catalogStatus']
>;

type IntegrationCatalogSectionProps = {
  integrationId: string;
  catalogStatus?: IntegrationCatalogStatus | null;
  refreshInterval?: GQLIntegrationCatalogRefreshInterval;
  onRefreshIntervalChange?: (
    interval: GQLIntegrationCatalogRefreshInterval,
  ) => void;
  canEditConfig: boolean;
  disabledReason?: string;
};

const refreshIntervalOptions = [
  { value: GQLIntegrationCatalogRefreshInterval.Hourly, label: 'Hourly' },
  {
    value: GQLIntegrationCatalogRefreshInterval.Every_6Hours,
    label: 'Every 6 hours',
  },
  { value: GQLIntegrationCatalogRefreshInterval.Daily, label: 'Daily' },
  { value: GQLIntegrationCatalogRefreshInterval.Weekly, label: 'Weekly' },
  {
    value: GQLIntegrationCatalogRefreshInterval.Manual,
    label: 'Only when refreshed manually',
  },
];

function catalogStatusText(status?: IntegrationCatalogStatus | null): string {
  if (
    status == null ||
    status.status === GQLIntegrationCatalogRefreshStatus.NeverRefreshed
  ) {
    return 'Never refreshed';
  }

  if (status.status === GQLIntegrationCatalogRefreshStatus.Error) {
    return `Refresh failed: ${status.errorMessage ?? 'The catalog could not be refreshed.'}`;
  }

  return `Up to date · refreshed ${safeFormatDistanceToNow(status.fetchedAt)}`;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Plugins may use long opaque versions (e.g. content hashes). */
function shortVersion(version: string) {
  return version.length > 20 ? `${version.slice(0, 19)}…` : version;
}

export default function IntegrationCatalogSection({
  integrationId,
  catalogStatus,
  refreshInterval,
  onRefreshIntervalChange,
  canEditConfig,
  disabledReason,
}: IntegrationCatalogSectionProps) {
  const client = useApolloClient();
  const [refreshCatalog, { loading }] = useGQLRefreshIntegrationCatalogMutation(
    {
      onCompleted: (data) => {
        const result = data.refreshIntegrationCatalog;
        if (result.__typename === 'RefreshIntegrationCatalogSuccessResponse') {
          evictOrgSignals(client.cache);
          const added = result.addedSignalTypeIds.length;
          const removed = result.removedSignalTypeIds.length;
          toast.success(
            added + removed === 0
              ? 'Catalog refreshed.'
              : `Catalog refreshed: ${pluralize(added, 'signal', 'signals')} added, ${removed} removed.`,
          );
        } else if (result.__typename === 'IntegrationCatalogRefreshError') {
          toast.error(
            result.detail == null
              ? result.title
              : `${result.title}: ${result.detail}`,
          );
        } else {
          toast.error(result.title);
        }
      },
      onError: () => {
        toast.error('Unable to refresh the signal catalog. Please try again.');
      },
      refetchQueries: ['IntegrationConfig'],
    },
  );

  const disabled = !canEditConfig || disabledReason != null;
  const catalogSignals = catalogStatus?.signals ?? [];

  const statusTone =
    catalogStatus?.status === GQLIntegrationCatalogRefreshStatus.Ok
      ? 'bg-emerald-500'
      : catalogStatus?.status === GQLIntegrationCatalogRefreshStatus.Error
        ? 'bg-red-500'
        : 'bg-slate-300';

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-800">
            Signal catalog
          </h2>
          <p
            className="mt-1 flex items-center gap-2 text-sm text-zinc-600"
            aria-live="polite"
          >
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusTone}`}
              aria-hidden="true"
            />
            {catalogStatusText(catalogStatus)}
          </p>
          {catalogStatus?.version != null && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {'Version '}
              <Tooltip title={catalogStatus.version}>
                <span className="font-mono">
                  {shortVersion(catalogStatus.version)}
                </span>
              </Tooltip>
            </p>
          )}
        </div>
        <CoopButton
          title="Refresh catalog"
          type="secondary"
          size="small"
          loading={loading}
          onClick={async () => {
            await refreshCatalog({ variables: { integrationId } });
          }}
          disabled={disabled}
          disabledTooltipTitle={
            disabledReason ??
            (!canEditConfig
              ? 'You do not have permission to edit this integration.'
              : undefined)
          }
        />
      </div>
      {refreshInterval != null && onRefreshIntervalChange != null && (
        <div className="mt-4 flex flex-col gap-1">
          <label
            htmlFor="integration-catalog-refresh-interval"
            className="text-sm font-medium text-zinc-800"
          >
            Refresh automatically
          </label>
          <Select
            id="integration-catalog-refresh-interval"
            className="w-64"
            aria-describedby="integration-catalog-refresh-interval-help"
            value={refreshInterval}
            disabled={!canEditConfig}
            options={refreshIntervalOptions}
            onChange={onRefreshIntervalChange}
          />
          <div
            id="integration-catalog-refresh-interval-help"
            className="text-xs text-zinc-500"
          >
            Saved with the integration&apos;s settings.
          </div>
        </div>
      )}
      {catalogSignals.length > 0 && (
        <ul
          className="m-0 mt-4 list-none divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white p-0"
          aria-label="Signals in this catalog"
        >
          {catalogSignals.map((signal) => (
            <li key={signal.signalTypeId} className="list-none px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-zinc-800">
                  {signal.displayName}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {signal.signalTypeId}
                </span>
                <span className="text-xs text-zinc-500">
                  ·{' '}
                  {signal.subcategories.length > 0
                    ? pluralize(
                        signal.subcategories.length,
                        'subcategory',
                        'subcategories',
                      )
                    : 'No subcategories'}
                </span>
              </div>
              {signal.subcategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-y-2">
                  {signal.subcategories.map((subcategory) => (
                    <Tag
                      key={subcategory.id}
                      title={subcategory.id}
                      className="m-0 mr-2"
                    >
                      {subcategory.label}
                    </Tag>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
