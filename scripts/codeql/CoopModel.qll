import javascript
import CachedFetcherModel
import BoundCallbackModel

/** Scope the query to application code rather than backend tests. */
predicate applicationNode(DataFlow::Node node) {
  not node.getFile()
      .getRelativePath()
      .regexpMatch(".*(node_modules|\\.test\\.|\\.spec\\.|^test/|^e2e/).*")
}

predicate namedType(TypeAnnotation annotation, string name) {
  annotation.(TypeAccess).getIdentifier().getName() = name
  or
  annotation.(GenericTypeExpr).getTypeAccess().getIdentifier().getName() = name
}

/**
 * Recognizes Coop's callable contract, not the implementation of BottleJS.
 * Property and type names are approximations, not resolved import identities.
 */
class CoopHttpCall extends DataFlow::CallNode {
  CoopHttpCall() {
    applicationNode(this) and
    exists(DataFlow::SourceNode callable | callable = this.getCalleeNode().getALocalSource() |
      callable.(DataFlow::PropRead).getPropertyName() = "fetchHTTP"
      or
      callable.(DataFlow::ParameterNode).getParameter().getTypeAnnotation().toString() = "FetchHTTP"
      or
      callable.(DataFlow::ParameterNode).getName() = "fetchHTTP"
      or
      exists(VarAccess access |
        access = this.getCalleeNode().asExpr() and
        access.getVariable().getADeclaration().getTypeAnnotation().toString() = "FetchHTTP"
      )
    )
  }

  DataFlow::Node getUrl() {
    result = this.getArgument(0).getALocalSource().getAPropertyWrite("url").getRhs()
  }
}

/** Sources explicitly designated at application trust boundaries. */
predicate coopSource(DataFlow::Node source, string kind) {
  applicationNode(source) and
  (
    source instanceof RemoteFlowSource and
    kind = source.(RemoteFlowSource).getSourceType()
    or
    exists(DataFlow::FunctionNode factory, DataFlow::FunctionNode handler |
      namedType(factory.getFunction().getReturnTypeAnnotation(),
        ["RequestHandler", "RequestHandlerWithBodies"]) and
      handler = factory.getAReturn().getALocalSource() and
      source = handler.getParameter(0).getAPropertyRead(["body", "query", "params"]) and
      kind = "REST handler factory input"
    )
    or
    exists(DataFlow::ParameterNode input |
      namedType(input.getParameter().getTypeAnnotation(), "SignalInput") and
      source = input.getAPropertyRead("value") and
      kind = "Signal input (explicit boundary)"
    )
    or
    exists(VariableDeclarator declaration, DataFlow::FunctionNode resolver |
      namedType(declaration.getTypeAnnotation(), ["GQLQueryResolvers", "GQLMutationResolvers"]) and
      resolver =
        declaration
            .getInit()
            .flow()
            .getALocalSource()
            .getAPropertyWrite(_)
            .getRhs()
            .getALocalSource() and
      source = resolver.getParameter(1) and
      kind = "GraphQL resolver arguments"
    )
    or
    exists(DataFlow::ParameterNode report |
      report.getParameter().getTypeAnnotation().toString() = "NCMECReportParams" and
      source = report.getAPropertyRead("media") and
      kind = "NCMEC media (explicit boundary)"
    )
    or
    exists(DataFlow::NewNode worker |
      worker.getCalleeName() = ["Worker", "BullWorker"] and
      source = worker.getCallback(1).getParameter(0).getAPropertyRead("data") and
      kind = "Queue payload (explicit boundary)"
    )
    or
    exists(CoopHttpCall call, AwaitExpr awaited, DataFlow::PropRead body |
      call.flowsTo(awaited.getOperand().flow()) and
      awaited.flow() = body.getBase().getALocalSource() and
      body.getPropertyName() = "body" and
      source = body and
      kind = "HTTP response body"
    )
  )
}

module ExposureConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) { coopSource(source, _) }

  predicate isSink(DataFlow::Node sink) { sink = any(CoopHttpCall call).getUrl() }
}

module ExposureFlow = TaintTracking::Global<ExposureConfig>;
