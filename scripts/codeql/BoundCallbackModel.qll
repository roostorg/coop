import javascript
import semmle.javascript.dataflow.internal.CallGraphs

/**
 * Propagates arguments into a uniquely resolved bound callback, including
 * callbacks passed through constructors. This is a may-flow approximation:
 * callback identity is not correlated with the full construction context.
 */
class BoundCallbackArguments extends DataFlow::SharedFlowStep {
  override predicate step(DataFlow::Node pred, DataFlow::Node succ) {
    exists(DataFlow::CallNode call, DataFlow::FunctionNode target, int bound, int index |
      bound > 0 and
      CallGraph::getABoundFunctionReference(target, bound, true).flowsTo(call.getCalleeNode()) and
      forall(DataFlow::FunctionNode other, int otherBound |
        other = call.getCalleeNode().getABoundFunctionValue(otherBound)
      |
        other = target and otherBound = bound
      ) and
      not exists(call.getASpreadArgument()) and
      pred = call.getArgument(index) and
      succ = target.getParameter(index + bound) and
      not succ.(DataFlow::ParameterNode).isRestParameter()
    )
  }
}
