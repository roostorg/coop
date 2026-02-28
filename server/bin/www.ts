#!/usr/bin/env node
import http from 'http';
import { promisify } from 'util';
import _ from 'lodash';

import getBottle from '../iocContainer/index.js';
import makeServer from '../server.js';
import {
  getIntegrationRegistry,
  getIntegrationsConfigPath,
} from '../services/integrationRegistry/index.js';
import { logErrorJson, logJson } from '../utils/logging.js';
import { sleep } from '../utils/misc.js';

const { app, shutdown } = await getBottle().then(async (bottle) =>
  makeServer(bottle.container),
);

// Eager-load integration registry so config/plugins are read at startup (fail fast, and so logo URLs are set).
try {
  const registry = getIntegrationRegistry();
  const configPath = getIntegrationsConfigPath();
  const ids = registry.getConfigurableIds();
  // eslint-disable-next-line no-restricted-syntax
  logJson(
    `Integrations: config=${configPath}, loaded=${ids.length} (${ids.join(', ')})`,
  );
} catch (err) {
  // eslint-disable-next-line no-restricted-syntax
  logErrorJson({
    message: 'Failed to load integrations registry',
    error: err instanceof Error ? err : new Error(String(err)),
  });
  process.exit(1);
}

const port = parsePort(process.env.PORT) ?? 8080;
app.set('port', port);

const server = http
  .createServer(app)
  .listen(port, () => {
    // eslint-disable-next-line no-restricted-syntax
    logJson(`Server is running at http://localhost:${port}`);
  })
  .on('error', function (error: NodeJS.ErrnoException) {
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({ error });
    if (error.syscall !== 'listen') {
      throw error;
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          error,
          message: `Port ${port} requires elevated privileges`,
        });
        process.exit(1);
      case 'EADDRINUSE':
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({ error, message: `Port ${port} is already in use.` });
        process.exit(1);
      default:
        throw error;
    }
  });

// We need the keep-alive timeout to be longer than the ALB's idle timeout to
// prevent the 502 errors we've been seeing. See this article for more info:
// https://adamcrowder.net/posts/node-express-api-and-aws-alb-502/
server.keepAliveTimeout = 65_000;

const shutdownOnce = _.once(async () => {
  try {
    const closeServer = promisify(server.close.bind(server));

    // Immediately disallow new connections + close idle ones.
    const serverClosedPromise = closeServer();
    server.closeIdleConnections();

    // For the remaining connections (that were still active when we called
    // `closeIdleConnections()` above), close them one at at time, as they
    // become idle. To do that, after a response is finished, we close all idle
    // connections, rather than just closing the socket that that request was
    // using to send its response. This is probably overkill (and not optimal
    // perf-wise, as `closeIdleConnections()` loops over all open connections)
    // but it's defensive against the (rare and likely-inapplicable) possibility
    // that the socket might still be in use for a request whose response hasn't
    // been sent yet. That can happen multiple requests were pipelined over the
    // same socket, which Nodejs supports (see
    // https://www.yld.io/blog/exploring-how-nodejs-handles-http-connections/),
    // although our load balancer probably never uses HTTP pipelining, as it's
    // ill-supported by backends. For this to make a difference, we're also
    // assuming that Node's definition of "idle" accounts for the possibility of
    // pipelining.
    server.prependListener('request', (_req, res) => {
      if (!res.headersSent) {
        res.setHeader('connection', 'close');
      }

      res.prependOnceListener('finish', () => {
        server.closeIdleConnections();
      });
    });

    // After 30s, if the server hasn't finished closing, force close all
    // connections. Waiting longer doesn't make sense because the load balancer will
    // time out the request at that point anyway.
    await Promise.race([sleep(30_000), serverClosedPromise]);
    server.closeAllConnections();

    // Now that there are no pending requests or open client connections, clean
    // up the app resources, like db connections, apollo plugins, etc.
    await shutdown();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({ message: 'error during shutdown', error: e });
    process.exit(1);
  }
});

process.on('uncaughtException', (err, _) => {
  // eslint-disable-next-line no-restricted-syntax
  logErrorJson({
    message: 'UncaughtException',
    error: err,
  });
  process.exit(1);
});

process.once('SIGTERM', shutdownOnce);
process.once('SIGINT', shutdownOnce);

function parsePort(val: string | undefined): number | undefined {
  if (!val) return undefined;

  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? undefined : parsed;
}
