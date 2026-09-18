import appConfig from '#config/app';

/**
 * Owns the externally-facing URLs the application hands out — SAML callbacks,
 * post-login redirects, password resets — so their paths are defined once
 * rather than interpolated at each call site.
 *
 * The origin defaults to `config/app`; the constructor parameter exists so a
 * test can pin it without going through the environment.
 */
export default class ConfigService {
  readonly #uiUrl: string;

  constructor(uiUrl: string = appConfig.uiUrl) {
    // `UI_URL` may or may not carry a trailing slash; normalising once here
    // avoids every consumer producing `//dashboard` when it does.
    this.#uiUrl = uiUrl.replace(/\/+$/, '');
  }

  /** Public origin of the frontend, without a trailing slash. */
  get uiUrl(): string {
    return this.#uiUrl;
  }

  /**
   * SAML issuer. Deliberately the UI origin rather than the API's own, since
   * that is the identifier registered with each org's identity provider.
   */
  get samlIssuer(): string {
    return this.#uiUrl;
  }

  /** Where a user lands after a successful login. */
  get dashboardUrl(): string {
    return `${this.#uiUrl}/dashboard`;
  }

  /**
   * Where an org's identity provider posts its SAML assertion back to. Note
   * this is on the UI origin: the API could be hosted on a different domain,
   * and the frontend proxies the callback through to it.
   */
  samlCallbackUrl(orgId: string): string {
    return `${this.#uiUrl}/api/v1/saml/login/${orgId}/callback`;
  }

  /**
   * Link emailed to a user so they can set a new password. The token is
   * hex-encoded (`randomBytes(32).toString('hex')`) and therefore already
   * path-safe; a token format using other characters would need encoding here.
   */
  resetPasswordUrl(token: string): string {
    return `${this.#uiUrl}/reset_password/${token}`;
  }

  /**
   * Link emailed to invite someone into an org. Like the reset token, the
   * invite token is hex-encoded and therefore already path-safe.
   */
  signupUrl(token: string): string {
    return `${this.#uiUrl}/signup/${token}`;
  }
}
