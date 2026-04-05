import * as oidcClient from 'openid-client';

export function normalizeIssuerUrl(raw: string): string {
  return `https://${raw.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

export async function discoverOidcConfig(
  issuerUrl: string,
  clientId: string,
  clientSecret: string,
) {
  const config = await oidcClient.discovery(
    new URL(issuerUrl),
    clientId,
    clientSecret,
  );

  const supported = config.serverMetadata().token_endpoint_auth_methods_supported;

  // Per OIDC spec, if token_endpoint_auth_methods_supported is absent the
  // default is ["client_secret_basic"]. If the server explicitly lists methods
  // and does NOT include client_secret_post, re-discover with ClientSecretBasic.
  if (supported && !supported.includes('client_secret_post')) {
    return oidcClient.discovery(
      new URL(issuerUrl),
      clientId,
      clientSecret,
      oidcClient.ClientSecretBasic(clientSecret),
    );
  }

  return config;
}
