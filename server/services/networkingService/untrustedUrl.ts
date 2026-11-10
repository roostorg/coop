import dns from 'node:dns';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, buildConnector } from 'undici';

export function createUrlAgents(options: Agent.Options) {
  return {
    trusted: new Agent(options),
    untrusted: new Agent({ ...options, connect: untrustedUrlConnector(false) }),
    loopback: new Agent({ ...options, connect: untrustedUrlConnector(true) }),
  };
}

export function isBlockedMediaAddress(address: string, allowLoopback: boolean) {
  const ip = ipaddr.process(address);
  const range = ip.range();
  if (range === 'loopback') return !allowLoopback;
  // Unclassified IPv6 ranges are not necessarily globally routable.
  return (
    range !== 'unicast' ||
    (ip.kind() === 'ipv6' && !ip.match(ipaddr.parse('2000::'), 3))
  );
}

function untrustedUrlConnector(
  allowLoopback: boolean,
): buildConnector.connector {
  const isBlocked = (address: string) =>
    isBlockedMediaAddress(address, allowLoopback);
  const blockedError = () =>
    new Error('Untrusted media URL resolves to a blocked IP address');
  const connect = buildConnector({
    lookup(hostname, options, callback) {
      // Validate the exact DNS results handed to the socket, including every
      // fallback address. Keep the hostname intact for Host, SNI, and TLS checks.
      dns.lookup(hostname, options, (error, address, family) => {
        if (error) {
          callback(error, address, family);
        } else if (
          typeof address === 'string'
            ? isBlocked(address)
            : address.some((result) => isBlocked(result.address))
        ) {
          callback(blockedError(), '', 0);
        } else {
          callback(null, address, family);
        }
      });
    },
  });

  return (options, callback) => {
    // Literal IPs bypass Node's DNS lookup callback.
    if (isIP(options.hostname) && isBlocked(options.hostname)) {
      callback(blockedError(), null);
      return;
    }
    connect(options, callback);
  };
}
