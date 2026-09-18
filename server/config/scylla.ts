import env from '#start/env';
import { types as scyllaTypes, type ClientOptions } from 'cassandra-driver';

const enabled = env.get('SCYLLA_ENABLED', true);

const contactPoints = env.get('SCYLLA_HOSTS');
const username = env.get('SCYLLA_USERNAME');
const password = env.get('SCYLLA_PASSWORD');

const firstContactPoint = contactPoints?.[0];

/**
 * A contact point may carry an explicit `:port`, which is not part of the
 * hostname a certificate is issued for. Only a single colon is a port
 * separator: a bare IPv6 address has several, and no port to strip.
 */
const firstHostname =
  firstContactPoint !== undefined && firstContactPoint.split(':').length === 2
    ? firstContactPoint.split(':')[0]
    : firstContactPoint;

// For TLS hostname verification we need an SNI value that matches the server
// cert. Prefer an explicit `SCYLLA_SSL_SERVERNAME` (e.g. the Keyspaces regional
// endpoint) over inferring one from `SCYLLA_HOSTS`, which may contain multiple
// contact points with different cert names.
const sslServerName = env.get('SCYLLA_SSL_SERVERNAME') ?? firstHostname;

/**
 * Scylla settings.
 *
 * `SCYLLA_ENABLED=false` swaps in a no-op client that drops writes and returns
 * empty reads, disabling Item Investigation and User Strikes. The connection
 * settings are then not needed, which is why they are optional here; when it is
 * on, `start/env.ts` requires them.
 *
 * N.B. Currently all our services that use Scylla as a backing datastore use the
 * same keyspace. If we ever need to add one (e.g. because we have tables that
 * need a new replication strategy, or we support multiple datacenters) we will
 * want one client per keyspace, since the driver is keyspace aware and switching
 * with `USE KEYSPACE` all the time is annoying and likely error prone.
 */
export default {
  enabled,

  /**
   * `null` when disabled, so a consumer cannot accidentally build a client
   * against settings that were never required.
   */
  connection: !enabled
    ? null
    : ({
        contactPoints: contactPoints ? [...contactPoints] : undefined,
        localDataCenter: env.get('SCYLLA_LOCAL_DATACENTER'),
        keyspace: 'item_investigation_service',
        // Omitted rather than half-filled when unset, so the driver falls back to
        // connecting without authentication.
        ...(username !== undefined &&
          password !== undefined && {
            credentials: { username, password: password.release() },
          }),
        protocolOptions: {
          port: env.get('SCYLLA_PORT', 9042),
        },
        // `servername` rather than `host`: the driver passes these straight to
        // `tls.connect(port, address, sslOptions)`, where an options `host`
        // overrides the positional address and so retargets the connection
        // itself. `servername` sets the SNI value and the certificate identity
        // check without moving where the driver connects.
        sslOptions: env.get('SCYLLA_SSL', false)
          ? {
              servername: sslServerName,
              rejectUnauthorized: true,
            }
          : undefined,
        pooling: {
          coreConnectionsPerHost: {
            [scyllaTypes.distance.local]: 3,
            [scyllaTypes.distance.remote]: 1,
          },
        },
        queryOptions: {
          // Quorum consistency requires a simple majority of nodes in a replica
          // group to respond to read/write requests. Local Quorum is the same
          // except it only expects nodes in the local datacenter to respond. For
          // our current Scylla infrastructure quorum and local quorum will have
          // identical behavior, but if we ever add another datacenter to the
          // cluster using Quorum and requiring responses from multiple DCs would
          // degrade performance significantly.
          consistency: scyllaTypes.consistencies.localQuorum,
        },
      } satisfies ClientOptions),
};
