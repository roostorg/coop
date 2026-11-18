import type { ApplicationService } from '@adonisjs/core/types';
import { type ApolloServer } from '@apollo/server';

import { makeApolloServer } from '../adonis/apollo.js';
import {
  makeAuthStack,
  type AuthStack,
} from '../app/middleware/session_bridge_middleware.js';
import { type Context } from '../graphql/resolvers.js';
import getBottle, { type Dependencies } from '../iocContainer/index.js';
import { registerKernel } from '../start/kernel.js';
import { registerRoutes } from '../start/routes.js';

declare module '@adonisjs/core/types' {
  // Every service in Coop's service graph is also an AdonisJS container
  // binding with the same name, so `await container.make('RuleEngine')` is
  // typed. `coop.deps` is the whole graph, for code that still takes a
  // `Dependencies` object.
  interface ContainerBindings extends Dependencies {
    'coop.deps': Dependencies;
    'coop.auth': AuthStack;
    'coop.apollo': ApolloServer<Context>;
  }
}

/**
 * Exposes Coop's service graph through the AdonisJS IoC container, and wires
 * the HTTP layer (routes, middleware, Apollo, sessions) on top of it.
 *
 * The services themselves are still defined in `iocContainer/index.ts` with
 * BottleJS: their factories read dependencies synchronously
 * (`container.KyselyPg`), while AdonisJS resolves bindings asynchronously, so
 * moving each one is a rewrite of that file and of every `deps.X` consumer.
 * This provider makes the graph one binding and re-exposes each service
 * lazily under its own name.
 *
 * Tests bind `coop.deps` to a mocked graph before boot (see
 * `adonis/createApp.ts`); the provider then uses that graph as-is.
 */
export default class CoopProvider {
  #apollo?: ApolloServer<Context>;
  #auth?: AuthStack;

  constructor(protected app: ApplicationService) {}

  register() {
    const { container } = this.app;
    if (!container.hasBinding('coop.deps')) {
      container.singleton(
        'coop.deps',
        async () => (await getBottle()).container,
      );
    }
    container.singleton('coop.auth', async (resolver) => {
      this.#auth = makeAuthStack(await resolver.make('coop.deps'));
      return this.#auth;
    });
    container.singleton('coop.apollo', async () => {
      this.#apollo = await makeApolloServer();
      return this.#apollo;
    });
  }

  async boot() {
    const deps = await this.app.container.make('coop.deps');

    // `Object.keys` on a Bottle container doesn't run the getters, so this
    // creates no service: each binding builds its service on first `make`.
    for (const name of Object.keys(deps) as (keyof Dependencies)[]) {
      this.app.container.singleton(name, () => deps[name]);
    }

    if (this.#servesHttp() && !process.env.SESSION_SECRET) {
      throw new Error('Missing env var SESSION_SECRET');
    }
  }

  /**
   * Routes and middleware are registered here instead of in `start/routes.ts`
   * and `start/kernel.ts` preload files. Preloads are imported once per
   * process, so a second app instance (one per test file) would boot with no
   * routes.
   */
  async start() {
    if (!this.#servesHttp()) {
      return;
    }
    const deps = await this.app.container.make('coop.deps');
    const server = await this.app.container.make('server');
    const router = await this.app.container.make('router');
    registerRoutes(router, deps, registerKernel(server, router));
    // Start Apollo at boot, as the Express app did, so schema errors fail the
    // deploy rather than the first request.
    await this.app.container.make('coop.apollo');
  }

  async shutdown() {
    // Workers, jobs and CLI commands close what they opened themselves (some
    // jobs call `closeSharedResourcesForShutdown` in their own `shutdown()`),
    // as they did before AdonisJS; a second close of a pg pool throws.
    if (!this.#servesHttp()) {
      return;
    }
    const deps = await this.app.container.make('coop.deps');
    await Promise.all([
      this.#apollo?.stop(),
      this.#auth?.close(),
      // Closes only what something created; it never starts a service just
      // to stop it.
      deps.closeSharedResourcesForShutdown(),
    ]);
  }

  #servesHttp() {
    return ['web', 'test'].includes(this.app.getEnvironment());
  }
}
