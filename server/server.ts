import express from 'express';

import makeApiApp from './api.js';
import { type Dependencies } from './iocContainer/index.js';

export default async function makeWWWServer(deps: Dependencies) {
  const { app: apiApp, shutdown } = await makeApiApp(deps);
  const app = express();

  // Traffic is routed to our app via: NLB -> ALB -> Express. The
  // NLB terminates TLS, so the NLB -> ALB request is over HTTP. As a
  // result, when the ALB hits express, it sets the `x-forwarded-proto` header
  // to `http`. This causes express to think the request is insecure, which
  // cause express-session to refuse to send a session cookie (since we mark our
  // session cookies with the `Secure` flag, which is designed to prevent both
  // server and client from sending the cookie in plaintext over HTTP).
  // express-session intentionally does not have a way to force it to skip the
  // secure check and unconditionally send the session cookie (see
  // https://github.com/expressjs/session/issues/785), so we have two options:
  //
  // 1. Override `req.secure` to always return true, so express-session thinks
  //    the request is secure.
  //
  // 2. Actually have the request hit the ALB over HTTPS, which involves either
  //    having the NLB re-encrypt the traffic on the way to the ALB, or having
  //    the NLB re-encrypt it and pass that through.
  //
  // Option 2 is more complex, so we go with option 1 for now. However, the risk
  // with option 1 is that different code/middleware will check different things
  // to determine whether the request is secure, and those checks disagreeing
  // could lead to subtle bugs. So, we limit that risk by patching as many
  // things as possible (i.e, also `req.protocol` and `x-forwarded-proto`); we
  // don't deal with the `Forwarded` header since that's more complicated and
  // less widely supported, so less likely to be checked by middleware.
  //
  // Note: forcing the ALB to set `x-forwarded-proto` to `https` is not an
  // option, as AWS doesn't support that.
  app.set('trust proxy', true);
  app.use((req, _res, next) => {
    // Define our overrides as getter properties to be consistent with their
    // definition in express, just in case.
    Object.defineProperty(req, 'secure', { get: () => true });
    Object.defineProperty(req, 'protocol', { get: () => 'https' });
    // NB: we overwrite the x-forwarded-proto, rather than append to it with a
    // comma, because x-forwarded-proto is a non-standardized header with no spec,
    // and it's not clear if appending is actually kosher/universally supported.
    req.headers['x-forwarded-proto'] = 'https';
    next();
  });

  app.use('/api/v1', apiApp);

  return { app, shutdown };
}
