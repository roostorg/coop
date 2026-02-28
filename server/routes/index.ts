import { type Route } from '../utils/route-helpers.js';
import ActionRoutes from './action/ActionRoutes.js';
import ContentRoutes from './content/ContentRoutes.js';
import GDPRRoutes from './gdpr/gdprRoutes.js';
import IntegrationLogosRoutes from './integration_logos/IntegrationLogosRoutes.js';
import ItemRoutes from './items/ItemRoutes.js';
import PoliciesRoutes from './policies/PoliciesRoutes.js';
import ReportingRoutes from './reporting/ReportingRoutes.js';
import UserScoresRoutes from './user_scores/UserScoresRoutes.js';

export type Controller = {
  // Path prefix expected to always start with a slash, given how we're
  // concatenating it with `/api/v1` in our server setup.
  pathPrefix: `/${string}`;
  routes: Route<any, any>[];
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  Items: ItemRoutes,
  Content: ContentRoutes,
  Reporting: ReportingRoutes,
  Policies: PoliciesRoutes,
  UserScores: UserScoresRoutes,
  Actions: ActionRoutes,
  GDPR: GDPRRoutes,
  IntegrationLogos: IntegrationLogosRoutes,
} satisfies { [key: string]: Controller };
