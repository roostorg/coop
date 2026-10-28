import { gql } from '@apollo/client';

import {
  GQLUserPermission,
  useGQLCoopUpdateAvailableQuery,
} from '../graphql/generated';

gql`
  query CoopUpdateAvailable {
    coopUpdateAvailable
  }
`;

export default function CoopUpdateBanner({
  permissions,
}: {
  permissions: readonly GQLUserPermission[] | undefined;
}) {
  const isAdmin = permissions?.includes(GQLUserPermission.ManageOrg) ?? false;
  const { data, error } = useGQLCoopUpdateAvailableQuery({
    skip: !isAdmin,
    fetchPolicy: 'network-only',
    pollInterval: 3_600_000,
    errorPolicy: 'ignore',
  });

  return (
    <div role="status" className="shrink-0">
      {isAdmin && !error && data?.coopUpdateAvailable && (
        <div className="bg-[#ECEFFF] px-4 py-2 text-center text-sm text-black dark:bg-[#2D1F4D] dark:text-white">
          A new version of Coop is available.{' '}
          <a
            href="https://github.com/roostorg/coop/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7165FF] underline underline-offset-4 hover:text-[#5147CC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#9D7BFF] dark:hover:text-[#BCA4FF]"
          >
            Learn more
          </a>
        </div>
      )}
    </div>
  );
}
