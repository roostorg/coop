import CoopModel
import utils.test.InlineExpectationsTest

module UrlFlowTest implements TestSig {
  string getARelevantTag() { result = "hasUrlFlow" }

  predicate hasActualResult(Location location, string element, string tag, string value) {
    exists(DataFlow::Node source, DataFlow::Node sink |
      ExposureFlow::flow(source, sink) and
      location = sink.getLocation() and
      element = sink.toString() and
      tag = "hasUrlFlow" and
      value = ""
    )
  }
}

import MakeTest<UrlFlowTest>
