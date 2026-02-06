import { Toast } from '@/coop-ui/Toast';
import { TooltipProvider } from '@/coop-ui/Tooltip';
import {
  ApolloClient,
  ApolloProvider,
  gql,
  InMemoryCache,
  StoreObject,
} from '@apollo/client';
import { KeyFieldsContext } from '@apollo/client/cache/inmemory/policies';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import stringify from 'safe-stable-stringify';

import FrontendTracer from './FrontendTracer';
import reportWebVitals from './reportWebVitals';
import App from './webpages/App';

if (
  typeof window !== 'undefined' &&
  process.env.REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT !== undefined
) {
  FrontendTracer();
}

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.REACT_APP_ENABLE_VIVID === 'true'
  // && /VIVID_ENABLED=true/.test(document.cookie)
) {
  import('vivid-studio').then((v) => v.run());
  import('vivid-studio/style.css');
}

declare global {
  interface Window {}
}

gql`
  query UserAndOrg {
    me {
      id
      email
    }
    myOrg {
      id
    }
  }
`;

// Apollo Client
const client = new ApolloClient({
  uri:
    process.env.NODE_ENV === 'production'
      ? '/api/v1/graphql'
      : 'http://localhost:3000/api/v1/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      ConditionInputField: {
        keyFields: false,
      },
      Signal: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          [
            object.id,
            object.type,
            object.subcategory ?? '',
            object.args ? stringify(object.args) : '',
          ].join(', '),
      },
      SignalSubcategory: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          stringify(object),
      },
      SignalArgs: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          stringify(object),
      },
      RuleExecutionResult: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) => {
          return `${object.contentId}.${object.ruleId}.${object.ts}`;
        },
      },
      LeafConditionWithResultSignal: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          stringify(object),
      },
      IntegrationConfig: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          stringify(object),
      },
      NCMECReport: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          stringify(object.reportId),
      },
      CoopModel: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          [object.id, object.version, object.status].join(', '),
      },
      ContentItem: {
        keyFields: ['submissionId'],
      },
      ThreadItem: {
        keyFields: ['submissionId'],
      },
      UserItem: {
        keyFields: ['submissionId'],
      },
      ItemSubmission: {
        keyFields: ['submissionId'],
      },
      ContentItemType: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          `${object.id}-${object.version}`,
      },
      UserItemType: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          `${object.id}-${object.version}`,
      },
      ThreadItemType: {
        keyFields: (object: Readonly<StoreObject>, _: KeyFieldsContext) =>
          `${object.id}-${object.version}`,
      },
    },
    possibleTypes: {
      Rule: ['ContentRule', 'UserRule'],
      ActionBase: [
        'CustomAction',
        'EnqueueToMrtAction',
        'EnqueueToNcmecAction',
        'EnqueueAuthorToMrtAction',
      ],
      ItemBase: ['ContentItem', 'UserItem', 'ThreadItem'],
      ItemTypeBase: ['ContentItemType', 'UserItemType', 'ThreadItemType'],
      Field: ['BaseField', 'DerivedField'],
      ManualReviewDecisionComponentBase: [
        'IgnoreDecisionComponent',
        'UserOrRelatedActionDecisionComponent',
        'SubmitNCMECReportDecisionComponent',
        'TransformJobAndRecreateInQueueDecisionComponent',
      ],
    },
  }),
});

const queryClient = new QueryClient();

// Pasted from https://react.dev/blog/2022/03/08/react-18-upgrade-guide#updates-to-client-rendering-apis
const root = createRoot(document.getElementById('root')!);
root.render(
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ApolloProvider client={client}>
        <TooltipProvider>
          <App />
          <Toast position="bottom-right" />
        </TooltipProvider>
      </ApolloProvider>
    </HelmetProvider>
  </QueryClientProvider>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(() => {});
