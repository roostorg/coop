import { route } from '../../utils/route-helpers.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import exportActivityCsv from './exportActivityCsv.js';

export default {
  pathPrefix: '/moderation_activity',
  routes: [
    route.get<undefined>('/export', exportActivityCsv),
  ] as ControllerRouteList,
} satisfies Controller;
