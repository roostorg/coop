import {
  FlowChartAltFilled,
  FriendsFilled,
  GraphAlt1Filled,
  SparklesFilled,
} from '@/icons';
import { gql } from '@apollo/client';
import compact from 'lodash/compact';
import { useEffect, useState, type ComponentType } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Navigate,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';

import { RequireAuth } from '../../routing/auth';

import './Dashboard.css';

import useDynamicLegacyCSS from '@/hooks/useDynamicLegacyCSS';

import ErrorBoundary from '@/components/ErrorBoundary';
import Sidebar, { MenuItem } from '@/components/Sidebar';

import {
  GQLUserPermission,
  namedOperations,
  useGQLDashboardOrgQuery,
  useGQLLogoutMutation,
} from '../../graphql/generated';

gql`
  query DashboardOrg {
    myOrg {
      id
      name
      hasReportingRulesEnabled
      hasNCMECReportingEnabled
      hasAppealsEnabled
      isDemoOrg
    }
    me {
      id
      permissions
      email
    }
  }

  mutation Logout {
    logout
  }
`;

const lazyRoute =
  (importFn: () => Promise<{ default: ComponentType }>) => async () => ({
    Component: (await importFn()).default,
  });

export function DashboardRoutes() {
  return {
    path: 'dashboard',
    element: (
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    ),
    children: [
      // Proactive Rules
      {
        path: '',
        element: <DashboardRoot />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'overview',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./overview/Overview')),
      },
      {
        path: 'rules',
        element: <Navigate replace to="proactive" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/proactive',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./rules/dashboard/RulesDashboard')),
      },
      {
        path: 'rules/proactive/info/:id',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./rules/info/RuleInfo')),
      },
      {
        path: 'rules/proactive/form/:id?',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./rules/rule_form/RuleForm')),
      },

      // Reporting Rules
      {
        path: 'rules/report',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(
          async () => import('./rules/dashboard/ReportingRulesDashboard'),
        ),
      },
      {
        path: 'rules/report/info/:id',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./rules/info/ReportingRuleInfo')),
      },
      {
        path: 'rules/report/form/:id?',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(
          async () => import('./rules/rule_form/ReportingRuleForm'),
        ),
      },
      // Matching Banks
      {
        path: 'banks',
        element: <Navigate replace to="/dashboard/rules/banks" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/banks',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./banks/MatchingBanksDashboard')),
      },
      {
        path: 'banks/text',
        element: <Navigate replace to="/dashboard/rules/banks?kind=TEXT" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'banks/location',
        element: <Navigate replace to="/dashboard/rules/banks?kind=LOCATION" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/banks/form/text/:id?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Text Banks Dashboard',
            buttonLinkPath: 'rules/banks',
          },
        },
        lazy: lazyRoute(async () => import('./banks/text/TextBankForm')),
      },
      {
        path: 'rules/banks/form/location/:id?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Location Banks Dashboard',
            buttonLinkPath: 'rules/banks',
          },
        },
        lazy: lazyRoute(
          async () => import('./banks/location/LocationBankForm'),
        ),
      },
      {
        path: 'rules/banks/form/hash/:id?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Hash Banks Dashboard',
            buttonLinkPath: 'rules/banks?kind=HASH',
          },
        },
        lazy: lazyRoute(async () => import('./banks/hash/HashBankForm')),
      },

      // Actions
      {
        path: 'actions',
        element: <Navigate replace to="../settings/actions" />,
        handle: { isUsingLegacyCSS: true },
      },

      // Item Types
      {
        path: 'item_types',
        element: <Navigate replace to="../settings/item_types" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'content_types',
        element: <Navigate replace to="../settings/item_types" />,
        handle: { isUsingLegacyCSS: true },
      },

      // Manual Review Tool (MRT)
      {
        path: 'manual_review',
        element: <Navigate replace to="queues" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'manual_review/queues',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(
          async () => import('./mrt/ManualReviewQueuesDashboard'),
        ),
      },
      {
        path: 'manual_review/queues/form/:id?',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./mrt/ManualReviewQueueForm')),
      },
      {
        path: 'manual_review/queues/review/:queueId/:jobId?/:lockToken?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to All Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./mrt/manual_review_job/ManualReviewJobReview'),
        ),
      },
      {
        path: 'manual_review/queues/jobs/:queueId',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to All Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./mrt/ManualReviewQueueJobsPreview'),
        ),
      },
      {
        path: 'manual_review/bulk-actioning',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./bulk_actioning/BulkActioningDashboard'),
        ),
      },
      {
        path: 'manual_review/investigation',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./investigation/InvestigationDashboard'),
        ),
      },
      {
        path: 'manual_review/ncmec_reports',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(async () => import('./ncmec/NcmecReportsDashboard')),
      },
      {
        path: 'manual_review/routing',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () =>
            import('./mrt/queue_routing/ManualReviewQueueRoutingDashboard'),
        ),
      },
      {
        path: 'manual_review/recent',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./mrt/ManualReviewRecentDecisions'),
        ),
      },
      {
        path: 'manual_review/safety',
        element: <Navigate replace to="/dashboard/account" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'manual_review/analytics',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
          },
        },
        lazy: lazyRoute(
          async () => import('./mrt/ManualReviewAnalyticsDashboard'),
        ),
      },
      {
        path: 'settings/appeal_settings',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
          },
        },
        lazy: lazyRoute(async () => import('./mrt/ManualReviewAppealSettings')),
      },

      // Redirect old Bulk Actioning Tool and Investigation paths
      {
        path: 'bulk-actioning',
        element: <Navigate replace to="../manual_review/bulk-actioning" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'investigation',
        element: <Navigate replace to="../manual_review/investigation" />,
        handle: { isUsingLegacyCSS: true },
      },

      // Policies
      {
        path: 'policies',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./policies/PoliciesDashboard')),
      },
      {
        path: 'policies/form/:existingPolicyId?',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./policies/PolicyForm')),
      },
      // TODO: uncomment this when final UI is finished
      {
        path: 'user_strikes',
        lazy: lazyRoute(
          async () => import('./userStrikes/UserStrikeDashboard'),
        ),
      },

      // Integrations
      {
        path: 'integrations',
        element: <Navigate replace to="../settings/integrations" />,
        handle: { isUsingLegacyCSS: true },
      },

      // Settings
      {
        path: 'settings',
        element: <Navigate replace to="item_types" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/item_types',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./item_types/ItemTypesDashboard')),
      },
      {
        path: 'settings/item_types/form/:id?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Item Types Dashboard',
          },
        },
        lazy: lazyRoute(async () => import('./item_types/ItemTypeForm')),
      },
      {
        path: 'settings/actions',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('./actions/ActionsDashboard')),
      },
      {
        path: 'settings/actions/form/:id?',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Actions Dashboard',
            buttonLinkPath: '/dashboard/actions',
          },
        },
        lazy: lazyRoute(async () => import('./actions/ActionForm')),
      },
      {
        path: 'settings/integrations',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(
          async () => import('./integrations/IntegrationsDashboard'),
        ),
      },
      {
        path: 'settings/integrations/:name',
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Integrations Dashboard',
          },
        },
        lazy: lazyRoute(
          async () => import('./integrations/IntegrationConfigForm'),
        ),
      },
      {
        path: 'settings/account',
        element: <Navigate replace to="/dashboard/account" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/api_auth',
        handle: { isUsingLegacyCSS: false },
        lazy: lazyRoute(
          async () => import('../settings/ApiAuthenticationSettings'),
        ),
      },
      {
        path: 'settings/org_safety_settings',
        handle: { isUsingLegacyCSS: false },
        lazy: lazyRoute(async () => import('../settings/OrgSafetySettings')),
      },
      {
        path: 'settings/ncmec',
        handle: { isUsingLegacyCSS: false },
        lazy: lazyRoute(async () => import('../settings/NCMECSettings')),
      },
      {
        path: 'settings/users',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('../settings/ManageUsers')),
      },
      {
        path: 'settings/sso',
        handle: { isUsingLegacyCSS: true },
        lazy: lazyRoute(async () => import('../settings/SSOSettings')),
      },
      {
        path: 'settings/organization',
        handle: { isUsingLegacyCSS: false },
        lazy: lazyRoute(async () => import('../settings/OrgSettings')),
      },
      // Account
      {
        path: 'account',
        handle: { isUsingLegacyCSS: false },
        lazy: lazyRoute(async () => import('../settings/AccountSettings')),
      },
    ],
  };
}

export type RouteHandle = {
  isUsingLegacyCSS?: boolean;
  error?: {
    buttonTitle: string;
    buttonLinkPath: string;
  };
};

/**
 * Org Dashboard screen
 */
export default function Dashboard() {
  const { pathname } = useLocation();
  const { loading, error, data } = useGQLDashboardOrgQuery();
  const navigate = useNavigate();
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);

  const [logout, { client }] = useGQLLogoutMutation({
    onError: () => {},
    onCompleted: (_data) => {
      client.clearStore().then(() => navigate('/'));
    },
    refetchQueries: [namedOperations.Query.PermissionGatedRouteLoggedInUser],
  });

  const matches = useMatches();
  const currentRouteHandle = matches[matches.length - 1]?.handle as RouteHandle;

  const isUsingLegacyCSS = matches.some(
    (match) => match.handle && (match.handle as RouteHandle).isUsingLegacyCSS,
  );

  const isCSSLoaded = useDynamicLegacyCSS(isUsingLegacyCSS);

  const permissions = data?.me?.permissions;
  const isDemoOrg = data?.myOrg?.isDemoOrg ?? false;

  const investigationAndBATItems = [
    {
      title: 'Investigation' as const,
      urlPath: 'investigation',
      requiredPermissions: [GQLUserPermission.ViewInvestigation],
    },
    {
      title: 'Bulk Actioning' as const,
      urlPath: 'bulk-actioning',
      requiredPermissions: [GQLUserPermission.ManuallyActionContent],
    },
  ];

  /**
   * All left sidebar menu items are listed here
   */
  const menuItems = compact([
    !isDemoOrg && {
      title: 'Overview' as const,
      urlPath: 'overview',
      icon: GraphAlt1Filled,
      requiredPermissions: [GQLUserPermission.ViewMrtData],
    },
    !isDemoOrg && {
      title: 'Automated Enforcement' as const,
      urlPath: 'rules',
      icon: FlowChartAltFilled,
      requiredPermissions: [GQLUserPermission.ViewRulesDashboard],
      subItems: compact([
        {
          title: 'Proactive Rules' as const,
          urlPath: 'proactive',
          requiredPermissions: [],
        },
        data?.myOrg?.hasReportingRulesEnabled
          ? {
              title: 'Report Rules' as const,
              urlPath: 'report',
              requiredPermissions: [GQLUserPermission.ViewMrt],
            }
          : null,
        {
          title: 'Matching Banks' as const,
          urlPath: 'banks',
          requiredPermissions: [GQLUserPermission.MutateNonLiveRules],
        },
        //TODO: uncomment this when final UI is finished
        // {
        //   title: 'User Strikes',
        //   urlPath: 'userStrikes',
        //   requiredPermissions: [GQLUserPermission.ManageOrg],
        // },
      ]),
    },
    {
      title: 'Policies' as const,
      urlPath: 'policies',
      icon: SparklesFilled,
      requiredPermissions: [GQLUserPermission.ManageOrg],
    },
    !isDemoOrg && {
      title: 'Review Console' as const,
      urlPath: 'manual_review',
      icon: FriendsFilled,
      requiredPermissions: [GQLUserPermission.ViewMrt],
      subItems: compact([
        {
          title: 'Queues' as const,
          urlPath: 'queues',
          requiredPermissions: [],
        },
        {
          title: 'Routing' as const,
          urlPath: 'routing',
          requiredPermissions: [GQLUserPermission.EditMrtQueues],
        },
        {
          title: 'Analytics' as const,
          urlPath: 'analytics',
          requiredPermissions: [GQLUserPermission.ViewMrtData],
        },
        ...investigationAndBATItems,
        {
          title: 'Recent Decisions' as const,
          urlPath: 'recent',
          requiredPermissions: [GQLUserPermission.ViewMrtData],
        },
        data?.myOrg?.hasNCMECReportingEnabled
          ? {
              title: 'NCMEC Reports' as const,
              urlPath: 'ncmec_reports',
              requiredPermissions: [GQLUserPermission.ViewChildSafetyData],
            }
          : null,
      ]),
    },
  ]) satisfies MenuItem[];

  const settingsMenuItems = [
    {
      title: 'Settings' as const,
      urlPath: 'settings',
      requiredPermissions: [],
      subItems: compact([
        {
          title: 'Item Types' as const,
          urlPath: 'item_types',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'Actions' as const,
          urlPath: 'actions',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'API Keys' as const,
          urlPath: 'api_auth',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'Integrations' as const,
          urlPath: 'integrations',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'Users' as const,
          urlPath: 'users',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        data?.myOrg?.hasAppealsEnabled
          ? {
              title: 'Appeal Settings' as const,
              urlPath: 'appeal_settings',
              requiredPermissions: [],
            }
          : null,
        {
          title: 'Wellness' as const,
          urlPath: 'org_safety_settings',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'Organization' as const,
          urlPath: 'organization',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
        {
          title: 'NCMEC Settings' as const,
          urlPath: 'ncmec',
          requiredPermissions: [GQLUserPermission.ManageOrg],
        },
      ]),
    },
  ] satisfies MenuItem[];

  // Whenever the URL 'pathname' changes, we want to update the
  // selectedMenuItem. For example, if someone loads the path
  // /dashboard/manual_review/queues, we want the "Queues" menu item under the
  // "Manual Review" menu item to be selected (i.e. highlighted). So we have to
  // traverse the menuItems object to figure out which item should be selected
  // based on the pathname.
  useEffect(() => {
    const pathParts = pathname.split('/');
    // The type assertion makes `items = item.subItems;` below work
    let items: MenuItem[] = [...menuItems, ...settingsMenuItems];
    // Start at i = 2 because pathParts[0] will always be "" and pathParts[1]
    // will always be "dashboard" since the route is /dashboard/..., but we
    // check that pathParts.length >= 2 just in case.
    if (pathParts.length < 2) {
      return;
    }

    for (let i = 2; i < pathParts.length; i++) {
      const part = pathParts[i];
      const item = items.find((item) => item.urlPath === part);
      if (item == null) {
        return;
      }
      if (item.subItems) {
        // If the item has subItems, we should continue searching down that path
        items = item.subItems;
      } else {
        // If the item has no subItems, just return the item's title
        setSelectedMenuItem(item.title);
      }
    }
  }, [menuItems, pathname, settingsMenuItems]);

  if (error) {
    throw error;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  return (
    <div
      className={`flex w-full h-screen${isUsingLegacyCSS ? '' : ' bg-slate-50'}`}
    >
      <Helmet>
        <title>Home</title>
      </Helmet>
      <Sidebar
        menuItems={menuItems}
        settingsMenuItems={settingsMenuItems}
        selectedMenuItem={selectedMenuItem}
        setSelectedMenuItem={setSelectedMenuItem}
        permissions={permissions}
        logout={async () => logout()}
        isDemoOrg={isDemoOrg}
      />
      {isUsingLegacyCSS ? (
        <>
          <div className="w-px h-full bg-[#e5e7eb]" />
          <div className="flex justify-center w-full px-12 py-8 overflow-auto">
            <ErrorBoundary
              key={pathname}
              containedInLayout
              buttonTitle={
                currentRouteHandle?.error?.buttonTitle ?? 'Return to dashboard'
              }
              buttonLinkPath={
                currentRouteHandle?.error?.buttonLinkPath
                  ? `/dashboard/${currentRouteHandle.error.buttonLinkPath}`
                  : '/dashboard'
              }
            >
              <div className="w-full max-w-[1800px]">
                {isCSSLoaded ? <Outlet /> : <FullScreenLoading />}
              </div>
            </ErrorBoundary>
          </div>
        </>
      ) : (
        <main className="flex flex-col flex-grow overflow-y-auto min-h-0">
          <div className="p-10">
            <ErrorBoundary
              key={pathname}
              containedInLayout
              buttonTitle={currentRouteHandle?.error?.buttonTitle}
              buttonLinkPath={currentRouteHandle?.error?.buttonLinkPath}
            >
              <div className="w-full max-w-[1800px]">
                <Outlet />
              </div>
            </ErrorBoundary>
          </div>
        </main>
      )}
    </div>
  );
}

function DashboardRoot() {
  const { loading, error, data } = useGQLDashboardOrgQuery();

  if (error) {
    return <Navigate replace to="../" />;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  // If the user doesn't have the permission to view MRT data, they're a
  // moderator, so they should be redirected to the Queues page.
  if (
    data?.me?.permissions &&
    !data.me.permissions.includes(GQLUserPermission.ViewMrtData)
  ) {
    return <Navigate replace to="manual_review/queues" />;
  } else {
    return <Navigate replace to="overview" />;
  }
}
