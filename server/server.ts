import {
  type IncomingMessage,
  type Server as NodeServer,
  type ServerResponse,
} from 'node:http';
import { type Router } from '@adonisjs/core/http';
import type { AppEnvironments } from '@adonisjs/core/types/app';

import { createCoopApp } from './adonis/createApp.js';
import { type Dependencies } from './iocContainer/index.js';

/**
 * Boots the AdonisJS application and returns its request handler, which can
 * be passed to `http.createServer` or supertest. All routes are under
 * `/api/v1` (see `start/routes.ts`).
 *
 * `deps` replaces the service graph the app would otherwise build with
 * `getBottle()`; the test harness passes a mocked one.
 */
export default async function makeWWWServer(
  deps?: Dependencies,
  opts: {
    environment?: Extract<AppEnvironments, 'web' | 'test'>;
    /** Test-only routes, registered after the app's own. */
    extraRoutes?: (router: Router) => void;
  } = {},
) {
  const environment = opts.environment ?? 'web';
  const { app } = await createCoopApp(environment, { deps });
  await app.boot();

  let handle!: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  let setNodeServer!: (server: NodeServer) => void;
  await app.start(async () => {
    const server = await app.container.make('server');
    opts.extraRoutes?.(await app.container.make('router'));
    await server.boot();
    handle = server.handle.bind(server);
    setNodeServer = server.setNodeServer.bind(server);
  });

  return {
    app: handle,
    adonisApp: app,
    setNodeServer,
    async shutdown() {
      await app.terminate();
    },
  };
}
