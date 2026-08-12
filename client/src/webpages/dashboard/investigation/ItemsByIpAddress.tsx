import { gql } from '@apollo/client';
import { Empty } from 'antd';
import { Link } from 'react-router-dom';

import ComponentLoading from '../../../components/common/ComponentLoading';
import FormSectionHeader from '../components/FormSectionHeader';

import { useGQLGetItemsByIpAddressQuery } from '../../../graphql/generated';
import { filterNullOrUndefined } from '../../../utils/collections';

gql`
  query GetItemsByIpAddress($ipAddress: String!, $limit: Int) {
    latestItemsByIpAddress(ipAddress: $ipAddress, limit: $limit) {
      latest {
        ... on ItemBase {
          id
          submissionId
          submissionTime
          type {
            ... on ItemTypeBase {
              id
              name
              version
            }
          }
        }
      }
    }
  }
`;

/**
 * Lists other items that share the same IP address as the item currently being
 * investigated, so a moderator can pivot from one item to everything else
 * associated with that IP (e.g. to spot ban evasion or coordinated abuse).
 *
 * Each row links into the standard item investigation view for that item.
 */
export default function ItemsByIpAddress(props: {
  ipAddress: string;
  currentItemId?: string;
  currentItemTypeId?: string;
}) {
  const { ipAddress, currentItemId, currentItemTypeId } = props;

  const { data, loading, error } = useGQLGetItemsByIpAddressQuery({
    variables: { ipAddress, limit: 50 },
  });

  const items = filterNullOrUndefined(data?.latestItemsByIpAddress ?? [])
    .map((it) => it.latest)
    .filter(
      (it) => !(it.id === currentItemId && it.type.id === currentItemTypeId),
    );

  return (
    <div className="flex flex-col items-start justify-start w-full">
      <div className="my-6 divider" />
      <FormSectionHeader title={`Other items from IP ${ipAddress}`} />
      {(() => {
        if (loading) {
          return <ComponentLoading />;
        }
        if (error) {
          return (
            <div className="text-start">
              Error loading items for this IP: {error.message}
            </div>
          );
        }
        if (items.length === 0) {
          return (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No other items found for this IP address"
            />
          );
        }
        return (
          <div className="flex flex-col w-full">
            {items.map((item) => (
              <Link
                key={`${item.type.id}-${item.id}`}
                to={`/dashboard/manual_review/investigation/?id=${encodeURIComponent(
                  item.id,
                )}&typeId=${encodeURIComponent(item.type.id)}`}
                className="flex flex-row items-center justify-between p-2 my-1 border border-gray-200 border-solid rounded-lg text-start hover:bg-gray-50"
              >
                <div className="flex flex-col">
                  <div className="font-bold">{item.type.name}</div>
                  <div className="text-sm text-slate-500">{item.id}</div>
                </div>
                {item.submissionTime ? (
                  <div className="text-sm text-slate-500">
                    {new Date(item.submissionTime).toLocaleString()}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
