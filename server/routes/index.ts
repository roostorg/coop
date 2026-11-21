import { type Route } from '../utils/route-helpers.js';
import ActionRoutes from './action/ActionRoutes.js';
import ContentRoutes from './content/ContentRoutes.js';
import IntegrationLogosRoutes from './integration_logos/IntegrationLogosRoutes.js';
import ItemTypeRoutes from './item_types/ItemTypeRoutes.js';
import ModerationActivityRoutes from './moderation_activity/ModerationActivityRoutes.js';
import PoliciesRoutes from './policies/PoliciesRoutes.js';
import UserScoresRoutes from './user_scores/UserScoresRoutes.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Controllers collect heterogeneous request and response body types.
export type ControllerRouteList = (Route<never, any> | Route<any, any>)[];

export type Controller = {
  // Path prefix expected to always start with a slash, given how we're
  // concatenating it with `/api/v1` in our server setup.
  pathPrefix: `/${string}`;
  routes: ControllerRouteList;
};

// Routes still served through the Express bridge (nest/rest/legacyRoutes.module.ts).
// POST /items/async and /report are Nest controllers in nest/rest/.
export default {
  ItemTypes: ItemTypeRoutes,
  Content: ContentRoutes,
  Policies: PoliciesRoutes,
  UserScores: UserScoresRoutes,
  Actions: ActionRoutes,
  IntegrationLogos: IntegrationLogosRoutes,
  ModerationActivity: ModerationActivityRoutes,
} satisfies { [key: string]: Controller };
