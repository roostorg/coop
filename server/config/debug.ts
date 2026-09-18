import env from '#start/env';

/**
 * Switches that trade safety for local diagnosability. Each one is off by
 * default and should stay off anywhere shared.
 */
export default {
  /**
   * Include implementation detail — stack traces, internal messages — in error
   * responses, rather than the sanitised message.
   */
  get exposeUnsafeErrorDetails() {
    return env.get('EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS', false);
  },

  /**
   * Permit loopback addresses in user-supplied URLs. Off by default because
   * user-supplied URLs reach outbound requests (e.g. webhook callbacks), so
   * allowing them widens SSRF reach to anything the server can see on
   * localhost.
   */
  get allowUserInputLocalhostUris() {
    return env.get('ALLOW_USER_INPUT_LOCALHOST_URIS', false);
  },
};
