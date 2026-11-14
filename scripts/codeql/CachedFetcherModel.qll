import javascript
import semmle.javascript.dataflow.internal.PreCallGraphStep

/**
 * A cache miss calls the supplied fetcher with the same key. Preserve its
 * callable identity for may-flow analysis across the caching wrapper.
 */
class CachedFetcherStep extends PreCallGraphStep {
  override predicate step(DataFlow::Node pred, DataFlow::Node succ) {
    exists(DataFlow::CallNode call |
      call.getFile().getRelativePath() =
        [
          "services/signalsService/helpers/makeCachedFetchers.ts",
          "server/services/signalsService/helpers/makeCachedFetchers.ts"
        ] and
      call.getCalleeName() = "toCachedFetcher" and
      pred = call.getArgument(0) and
      succ = call
    )
  }
}
