# Automated DNS provider onboarding

JPosta detects authoritative nameservers when a domain is added. Cloudflare and Namecheap can be
connected temporarily so JPosta can preview and apply the required mail records. Other providers
continue to use the manual DNS workflow.

## Cloudflare

Create a public OAuth client in **Manage Account → OAuth clients** using the Authorization Code
flow and `client_secret_post` token authentication. Configure:

- Redirect URL: `https://<api-host>/domains/provider/cloudflare/callback`
- Required scopes: Zone Read, DNS Read, and DNS Write
- Client URL: the public JPosta web URL (Cloudflare requires publisher-domain verification before
  a client can become public)

Set `CLOUDFLARE_OAUTH_CLIENT_ID`, `CLOUDFLARE_OAUTH_CLIENT_SECRET`,
`CLOUDFLARE_OAUTH_REDIRECT_URI`, and the exact registered scope identifiers in
`CLOUDFLARE_OAUTH_SCOPES`. JPosta encrypts the resulting tokens and revokes access after DNS
verification.

## Namecheap

Set `NAMECHEAP_CLIENT_IP` to the API service's stable public IPv4 address. The customer must enable
API access under **Profile → Tools → Namecheap API Access** and whitelist this address before
connecting.

JPosta accepts the API username and key, never the account password. Namecheap's `setHosts` API
replaces omitted records, so JPosta reads the entire zone and preserves all unrelated records on
every update. The encrypted API key is deleted after verification; Namecheap does not provide a
delegated revocation endpoint, so customers may rotate the key separately if desired.

## Shared security configuration

Set `DNS_PROVIDER_CREDENTIAL_ENCRYPTION_SECRET` to a dedicated random secret of at least 32
characters. Provider connections expire after 24 hours, OAuth state expires after 10 minutes, and
expired data is removed hourly.
