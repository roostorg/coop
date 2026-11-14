/**
 * @name Externally influenced outbound URL
 * @description Reports input-to-URL paths for review, not confirmed SSRF vulnerabilities.
 * @kind path-problem
 * @problem.severity recommendation
 * @id coop/external-http-url
 */

import CoopModel
import ExposureFlow::PathGraph

from ExposureFlow::PathNode source, ExposureFlow::PathNode sink, string kind
where ExposureFlow::flowPath(source, sink) and coopSource(source.getNode(), kind)
select sink.getNode(), source, sink, "URL derives from " + kind + "."
