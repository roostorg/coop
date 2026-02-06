import {
  FlowChartAltFilled,
  FriendsFilled,
  GraphAlt1Filled,
  SparklesFilled,
} from '@/icons';
import { gql } from '@apollo/client';
import compact from 'lodash/compact';
import { useEffect, useState } from 'react';
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
import AccountSettings from '../settings/AccountSettings';
import ApiAuthenticationSettings from '../settings/ApiAuthenticationSettings';
import ManageUsers from '../settings/ManageUsers';
import OrgSettings from '../settings/OrgSettings';
import ActionForm from './actions/ActionForm';
import ActionsDashboard from './actions/ActionsDashboard';
import LocationBankForm from './banks/location/LocationBankForm';
import TextBankForm from './banks/text/TextBankForm';
import HashBankForm from './banks/hash/HashBankForm';
import BulkActioningDashboard from './bulk_actioning/BulkActioningDashboard';
import IntegrationConfigForm from './integrations/IntegrationConfigForm';
import IntegrationsDashboard from './integrations/IntegrationsDashboard';
import InvestigationDashboard from './investigation/InvestigationDashboard';
import ItemTypeForm from './item_types/ItemTypeForm';
import ItemTypesDashboard from './item_types/ItemTypesDashboard';
import ManualReviewJobReview from './mrt/manual_review_job/ManualReviewJobReview';
import ManualReviewAnalyticsDashboard from './mrt/ManualReviewAnalyticsDashboard';
import ManualReviewQueueForm from './mrt/ManualReviewQueueForm';
import ManualReviewQueueJobsPreview from './mrt/ManualReviewQueueJobsPreview';
import ManualReviewQueuesDashboard from './mrt/ManualReviewQueuesDashboard';
import ManualReviewRecentDecisions from './mrt/ManualReviewRecentDecisions';
import ManualReviewQueueRoutingDashboard from './mrt/queue_routing/ManualReviewQueueRoutingDashboard';
import NcmecReportsDashboard from './ncmec/NcmecReportsDashboard';
import PoliciesDashboard from './policies/PoliciesDashboard';
import ReportingRulesDashboard from './rules/dashboard/ReportingRulesDashboard';
import RulesDashboard from './rules/dashboard/RulesDashboard';
import ReportingRuleInfo from './rules/info/ReportingRuleInfo';
import RuleInfo from './rules/info/RuleInfo';
import ReportingRuleForm from './rules/rule_form/ReportingRuleForm';
import RuleForm from './rules/rule_form/RuleForm';

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
import OrgSafetySettings from '../settings/OrgSafetySettings';
import NCMECSettings from '../settings/NCMECSettings';
import SSOSettings from '../settings/SSOSettings';
import MatchingBanksDashboard from './banks/MatchingBanksDashboard';
import Layout from './Layout';
import ManualReviewAppealSettings from './mrt/ManualReviewAppealSettings';
import Overview from './overview/Overview';
import PolicyForm from './policies/PolicyForm';
import UserStrikeDashboard from './userStrikes/UserStrikeDashboard';

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
        element: <Overview />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules',
        element: <Navigate replace to="proactive" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/proactive',
        element: <RulesDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/proactive/info/:id',
        element: <RuleInfo />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/proactive/form/:id?',
        element: <RuleForm />,
        handle: { isUsingLegacyCSS: true },
      },

      // Reporting Rules
      {
        path: 'rules/report',
        element: <ReportingRulesDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/report/info/:id',
        element: <ReportingRuleInfo />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/report/form/:id?',
        element: <ReportingRuleForm />,
        handle: { isUsingLegacyCSS: true },
      },
      // Matching Banks
      {
        path: 'banks',
        element: <Navigate replace to="/dashboard/rules/banks" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'rules/banks',
        element: <MatchingBanksDashboard />,
        handle: { isUsingLegacyCSS: true },
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
        element: <TextBankForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Text Banks Dashboard',
            buttonLinkPath: 'rules/banks',
          },
        },
      },
      {
        path: 'rules/banks/form/location/:id?',
        element: <LocationBankForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Location Banks Dashboard',
            buttonLinkPath: 'rules/banks',
          },
        },
      },
      {
        path: 'rules/banks/form/hash/:id?',
        element: <HashBankForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Hash Banks Dashboard',
            buttonLinkPath: 'rules/banks?kind=HASH',
          },
        },
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
        element: <ManualReviewQueuesDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'manual_review/queues/form/:id?',
        element: <ManualReviewQueueForm />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'manual_review/queues/review/:queueId/:jobId?/:lockToken?',
        element: <ManualReviewJobReview />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to All Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/queues/jobs/:queueId',
        element: <ManualReviewQueueJobsPreview />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to All Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/bulk-actioning',
        element: <BulkActioningDashboard />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/investigation',
        element: <InvestigationDashboard />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/ncmec_reports',
        element: <NcmecReportsDashboard />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/routing',
        element: <ManualReviewQueueRoutingDashboard />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/recent',
        element: <ManualReviewRecentDecisions />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
            buttonLinkPath: 'manual_review/queues',
          },
        },
      },
      {
        path: 'manual_review/safety',
        element: <Navigate replace to="/dashboard/account" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'manual_review/analytics',
        element: <ManualReviewAnalyticsDashboard />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
          },
        },
      },
      {
        path: 'settings/appeal_settings',
        element: <ManualReviewAppealSettings />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Manual Review Queues',
          },
        },
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
        element: <PoliciesDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'policies/form/:existingPolicyId?',
        element: <PolicyForm />,
        handle: { isUsingLegacyCSS: true },
      },
      // TODO: uncomment this when final UI is finished
      { path: 'user_strikes', element: <UserStrikeDashboard /> },

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
        element: <ItemTypesDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/item_types/form/:id?',
        element: <ItemTypeForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Item Types Dashboard',
          },
        },
      },
      {
        path: 'settings/actions',
        element: <ActionsDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/actions/form/:id?',
        element: <ActionForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Actions Dashboard',
            buttonLinkPath: '/dashboard/actions',
          },
        },
      },
      {
        path: 'settings/integrations',
        element: <IntegrationsDashboard />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/integrations/:name',
        element: <IntegrationConfigForm />,
        handle: {
          isUsingLegacyCSS: true,
          error: {
            buttonTitle: 'Back to Integrations Dashboard',
          },
        },
      },
      {
        path: 'settings/account',
        element: <Navigate replace to="/dashboard/account" />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/api_auth',
        element: <ApiAuthenticationSettings />,
        handle: { isUsingLegacyCSS: false },
      },
      {
        path: 'settings/org_safety_settings',
        element: <OrgSafetySettings />,
        handle: { isUsingLegacyCSS: false },
      },
      {
        path: 'settings/ncmec',
        element: <NCMECSettings />,
        handle: { isUsingLegacyCSS: false },
      },
      {
        path: 'settings/users',
        element: <ManageUsers />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/sso',
        element: <SSOSettings />,
        handle: { isUsingLegacyCSS: true },
      },
      {
        path: 'settings/organization',
        element: <OrgSettings />,
        handle: { isUsingLegacyCSS: false },
      },
      // Account
      {
        path: 'account',
        element: <AccountSettings />,
        handle: { isUsingLegacyCSS: false },
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
          title: 'Employee Safety' as const,
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

  if (isUsingLegacyCSS) {
    return (
      <div className="flex w-full h-screen">
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
        <div className="w-px h-full bg-[#e5e7eb]" />
        <div className="flex justify-center w-full px-12 py-8 overflow-scroll scrollbar-hide">
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
            <div className="w-full max-w-[1280px]">
              {isCSSLoaded ? <Outlet /> : <FullScreenLoading />}
            </div>
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <Layout
      sidebarSlot={
        <Sidebar
          menuItems={menuItems}
          settingsMenuItems={settingsMenuItems}
          selectedMenuItem={selectedMenuItem}
          setSelectedMenuItem={setSelectedMenuItem}
          permissions={permissions}
          logout={async () => logout()}
          isDemoOrg={isDemoOrg}
        />
      }
    />
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
