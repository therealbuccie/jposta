# JPosta Workspace Mail Portals

Organization mail portals are served from wildcard workspace subdomains such as:

- `golivyn.jposta.com`
- `36tstudios.jposta.com`
- `talktrek.jposta.com`

Employees keep their real mailbox address, for example `info@golivyn.com`; the portal host is only the login surface.

## DNS

Create a wildcard record pointing to the web entrypoint:

| Type | Name | Value           |
| ---- | ---- | --------------- |
| A    | `*`  | `84.247.131.29` |

Cloudflare proxy should be enabled.

## Nginx

All public web hosts should proxy to the same `apps/web` container:

```nginx
server_name jposta.com www.jposta.com *.jposta.com;
```

Do not route `api.jposta.com` to the web container; it remains the NestJS API host.

## TLS

Use a certificate strategy covering both:

- `jposta.com`
- `*.jposta.com`

Preferred options:

- Cloudflare Origin Certificate covering apex and wildcard names
- DNS-validated wildcard certificate from ACME/Let�s Encrypt

## API CORS

The API validates concrete origins instead of using wildcard origins with credentials. Approved production origins are:

- `https://jposta.com`
- `https://www.jposta.com`
- `https://<workspace>.jposta.com`

Malformed hosts such as `https://golivyn.jposta.com.evil.com` must remain blocked.
