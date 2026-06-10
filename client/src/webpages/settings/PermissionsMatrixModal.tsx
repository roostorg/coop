import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/coop-ui/Dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/coop-ui/Tooltip';
import {
  GQLUserPermission,
  GQLUserRole,
  useGQLPermissionGroupsQuery,
} from '@/graphql/generated';
import { titleCaseEnumString } from '@/utils/string';
import { Check, X } from 'lucide-react';
import { useMemo } from 'react';

function GrantIndicator(props: { granted: boolean; label: string }) {
  if (props.granted) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500"
        role="img"
        aria-label={props.label}
      >
        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 text-gray-300"
      role="img"
      aria-label={props.label}
    >
      <X className="w-4 h-4" strokeWidth={2} aria-hidden />
    </span>
  );
}

type RoleSummary = {
  key: GQLUserRole;
  displayName: string;
  permissions: readonly GQLUserPermission[];
  userCount: number;
};

const TOOLTIP_Z = '!z-[9999]';

export default function PermissionsMatrixModal(props: {
  roles: readonly RoleSummary[];
  onClose: () => void;
}) {
  const { roles, onClose } = props;
  const { data, loading } = useGQLPermissionGroupsQuery();
  const groups = data?.permissionGroups ?? [];

  const orderedRoles = useMemo(() => roles.slice(), [roles]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[1280px] w-[95vw] p-0">
        <TooltipProvider delayDuration={150}>
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <DialogTitle className="text-2xl">Permissions Overview</DialogTitle>
            <DialogClose
              aria-label="Close"
              className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
            >
              <X className="w-5 h-5" aria-hidden />
            </DialogClose>
          </div>
          <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
            <div className="text-sm text-gray-600 mb-4">
              Overview of which permissions are granted to each role. Changes to
              role permissions affect all users with that role.
            </div>

            {loading && (
              <div className="text-sm text-gray-500">Loading permissions…</div>
            )}

            {!loading &&
              groups.map((group) => (
                <div key={group.key} className="flex flex-col gap-2 mb-6">
                  <div className="text-base font-semibold mt-2">
                    {group.label}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <colgroup>
                        <col className="w-[260px]" />
                        {orderedRoles.map((role) => (
                          <col key={role.key} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 font-semibold align-bottom">
                            Permission
                          </th>
                          {orderedRoles.map((role) => {
                            const roleLabel =
                              role.displayName || titleCaseEnumString(role.key);
                            return (
                              <th
                                key={role.key}
                                className="text-center py-2 px-2 font-semibold align-bottom"
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <div className="truncate">
                                        {roleLabel}
                                      </div>
                                      <div className="text-xs text-gray-500 font-normal">
                                        {role.userCount} user
                                        {role.userCount === 1 ? '' : 's'}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    align="center"
                                    className={`max-w-xs ${TOOLTIP_Z}`}
                                  >
                                    <div className="font-semibold">
                                      {roleLabel}
                                    </div>
                                    <div className="mt-1 font-normal">
                                      {role.userCount} user
                                      {role.userCount === 1 ? '' : 's'}
                                      {' • '}
                                      {role.permissions.length} permission
                                      {role.permissions.length === 1 ? '' : 's'}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {group.permissions.map((p) => (
                          <tr
                            key={p.permission}
                            className="border-b border-gray-100"
                          >
                            <td className="py-3 pr-4 align-middle">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    <div className="text-sm font-medium line-clamp-1">
                                      {p.label}
                                    </div>
                                    {p.description && (
                                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {p.description}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  align="start"
                                  className={`max-w-xs ${TOOLTIP_Z}`}
                                >
                                  <div className="font-semibold">{p.label}</div>
                                  {p.description && (
                                    <div className="mt-1 font-normal">
                                      {p.description}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            {orderedRoles.map((role) => {
                              const granted = role.permissions.includes(
                                p.permission,
                              );
                              const roleLabel =
                                role.displayName ||
                                titleCaseEnumString(role.key);
                              return (
                                <td
                                  key={role.key}
                                  className="text-center py-3 px-2 align-middle"
                                >
                                  <GrantIndicator
                                    granted={granted}
                                    label={
                                      granted
                                        ? `${roleLabel} has ${p.label}`
                                        : `${roleLabel} does not have ${p.label}`
                                    }
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
