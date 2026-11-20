import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';

/**
 * Traffic reaches the server via NLB -> ALB -> Node. The NLB terminates TLS, so
 * the ALB tells us `x-forwarded-proto: http`, and the session middleware would
 * then refuse to send our `Secure` session cookie. AWS can't make the ALB send
 * `https`, so we treat every request as HTTPS: the `secure` and `protocol`
 * getters that Connect-style middleware (express-session) reads, and the
 * header that AdonisJS' `request.protocol()` reads with `trustProxy`.
 */
export default class ForceHttpsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const req = ctx.request.request;
    Object.defineProperty(req, 'secure', { get: () => true });
    Object.defineProperty(req, 'protocol', { get: () => 'https' });
    // Overwritten rather than appended: x-forwarded-proto has no spec for
    // comma-separated values.
    req.headers['x-forwarded-proto'] = 'https';
    return next();
  }
}
