// eslint-disable-next-line no-restricted-imports
import ReviewConsoleIcon from '@/icons/lni/User/review-console.svg?react';
import { gql } from '@apollo/client';
import { Building2, Gavel, Heart, KeyRound, Settings2 } from 'lucide-react';
import { useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';

import DashboardHeader from '../dashboard/components/DashboardHeader';

import AppealsTab from './tabs/AppealsTab';
import OrganizationTab from './tabs/OrganizationTab';
import OtherTab from './tabs/OtherTab';
import ReviewConsoleTab from './tabs/ReviewConsoleTab';
import SSOTab from './tabs/SSOTab';
import WellnessTab from './tabs/WellnessTab';

gql`
  query DeploymentSettings {
    me {
      id
      permissions
    }
    myOrg {
      id
      hasAppealsEnabled
      hasReportingRulesEnabled
      allowMultiplePoliciesPerAction
      requiresPolicyForDecisionsInMrt
      requiresDecisionReasonInMrt
      requiresDecisionReasonOnIgnoreInMrt
      previewJobsViewEnabled
      hideSkipButtonForNonAdmins
      userStrikeTTL
      samlEnabled
      ssoUrl
      ssoCert
      ignoreCallbackUrl
      partialItemsEndpoint
      partialItemsRequestHeaders
    }
    appealSettings {
      appealsCallbackUrl
      appealsCallbackHeaders
      appealsCallbackBody
    }
  }

  mutation UpdateHasAppealsEnabled($enabled: Boolean!) {
    updateHasAppealsEnabled(enabled: $enabled)
  }
  mutation UpdateHasReportingRulesEnabled($enabled: Boolean!) {
    updateHasReportingRulesEnabled(enabled: $enabled)
  }
  mutation UpdateAllowMultiplePoliciesPerAction($enabled: Boolean!) {
    updateAllowMultiplePoliciesPerAction(enabled: $enabled)
  }
  mutation UpdateSamlEnabled($enabled: Boolean!) {
    updateSamlEnabled(enabled: $enabled)
  }
  mutation UpdateRequiresPolicyForDecisions($enabled: Boolean!) {
    updateRequiresPolicyForDecisions(enabled: $enabled)
  }
  mutation UpdateRequiresDecisionReason($enabled: Boolean!) {
    updateRequiresDecisionReason(enabled: $enabled)
  }
  mutation UpdateRequiresDecisionReasonOnIgnore($enabled: Boolean!) {
    updateRequiresDecisionReasonOnIgnore(enabled: $enabled)
  }
  mutation UpdateHideSkipButtonForNonAdmins($enabled: Boolean!) {
    updateHideSkipButtonForNonAdmins(enabled: $enabled)
  }
  mutation UpdatePreviewJobsViewEnabled($enabled: Boolean!) {
    updatePreviewJobsViewEnabled(enabled: $enabled)
  }
  mutation UpdateIgnoreCallbackUrl($url: String) {
    updateIgnoreCallbackUrl(url: $url)
  }
`;

type Tab =
  | 'organization'
  | 'sso'
  | 'appeals'
  | 'review-console'
  | 'wellness'
  | 'other';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  {
    value: 'organization',
    label: 'Organization',
    icon: <Building2 size={16} />,
  },
  { value: 'sso', label: 'Single Sign-On', icon: <KeyRound size={16} /> },
  { value: 'appeals', label: 'Appeals', icon: <Gavel size={16} /> },
  {
    value: 'review-console',
    label: 'Review Console',
    icon: <ReviewConsoleIcon className="w-4.5 h-4.5" />,
  },
  { value: 'wellness', label: 'Wellness', icon: <Heart size={16} /> },
  { value: 'other', label: 'Other', icon: <Settings2 size={16} /> },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab =
    tabParam && TABS.some((t) => t.value === tabParam)
      ? tabParam
      : 'organization';

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <>
      <Helmet>
        <title>Settings</title>
      </Helmet>

      <div className="max-w-[1200px]">
        <DashboardHeader
          title="Settings"
          subtitle="Configure organization-level settings including appeals, SSO, partial items, and other core features."
        />

        <nav className="flex border-b border-gray-200 mb-4" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium tracking-[0.07px] border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => handleTabChange(tab.value)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'sso' && <SSOTab />}
        {activeTab === 'appeals' && <AppealsTab />}
        {activeTab === 'review-console' && <ReviewConsoleTab />}
        {activeTab === 'wellness' && <WellnessTab />}
        {activeTab === 'other' && <OtherTab />}
      </div>
    </>
  );
}
