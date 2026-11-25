import { HttpResponse } from '@adonisjs/core/http';

/**
 * AdonisJS generates strong ETags (`"7-…"`); Express generated weak ones
 * (`W/"7-…"`) for every body, and clients may hold them in caches. Make weak
 * the default. Conditional requests still work: AdonisJS' freshness check
 * compares ETags weakly.
 */
const { setEtag } = HttpResponse.prototype;
HttpResponse.prototype.setEtag = function (
  this: HttpResponse,
  body: unknown,
  weak = true,
) {
  return setEtag.call(this, body, weak);
};
