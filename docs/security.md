# Application security

What the API defends against today, where each defence lives and what checks it, and what is still missing before Flowboard holds anyone's data. The repository, CI and supply chain have their own page: [ci-and-security.md](ci-and-security.md).

## Contents

- [Status](#status)
- [Defences](#defences)
- [Configuration](#configuration)
- [Accounts](#accounts)
- [Not covered yet](#not-covered-yet)

---

## Status

Flowboard is not deployed and has no accounts: whoever reaches the API can read and change every board. Today's defences therefore keep the API reachable only from the computer running it, and set the rules that still hold once there are accounts: strict input, JSON-only responses that cannot run as a page, no internals in errors.

## Defences

| Threat | Defence | Where | Checked by |
|---|---|---|---|
| Another device on the network reads or changes the boards | The API listens on `127.0.0.1` only (`HOST`); PostgreSQL publishes its port on `127.0.0.1` | `apps/api/src/index.ts`, `compose.yaml` | `Get-NetTCPConnection -LocalPort 3700 -State Listen` (macOS: `lsof -nP -iTCP:3700 -sTCP:LISTEN`) shows `127.0.0.1` only |
| A web page reaches the local API by DNS rebinding (its own domain pointed at `127.0.0.1`) | The `Host` header must be `localhost`, `127.0.0.1`, `[::1]` or one of `ALLOWED_HOSTS`, else `403`, before the body is read | `checkHost` in `apps/api/src/security.ts` | `apps/api/test/security.test.ts` |
| Another site sends writes from the user's browser (CSRF) | No CORS headers, so a page from another origin cannot read any answer, and cannot send `PATCH`, `DELETE` or a JSON body without a preflight the API never grants. What it can send, a form or `text/plain` `POST`, has no JSON body, which every write requires: `400` | `apps/api/src/app.ts`, the request schemas | `security.test.ts` |
| A response is run, framed or sniffed as a page | Every response is JSON, with `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store` | `setSecurityHeaders` in `security.ts` | `security.test.ts` |
| Malformed, oversized or unexpected input | Request bodies checked against strict Zod schemas: an unknown field is a `400`. Lengths are limited, with the same limits on the web app's inputs. Bodies over 100 kB are a `413`, unread | `@flowboard/shared/schemas`, `apps/api/src/validation.ts`, `app.ts` | `security.test.ts`, each route's tests |
| SQL injection | Queries go through Prisma; the few raw ones are tagged templates, which send every value as a parameter | `apps/api/src/*/…-queries.ts` | code review |
| A card linked to another board's labels, members or columns | Every id in a write is checked against the card's board: `400` | `card-queries.ts` | `cards.test.ts` |
| Script in user text (XSS) | React escapes all text it renders; the web app never sets HTML from data (`dangerouslySetInnerHTML`) | `apps/web/src` | code review |
| A copy of the database gives away passwords | Only a salted scrypt hash is stored ([Accounts](#accounts)) | `apps/api/src/auth/passwords.ts` | `apps/api/test/passwords.test.ts` |
| Internals leaked by errors | An unexpected error answers a fixed message, with the details only in the server's log; no `X-Powered-By` | `apps/api/src/errors.ts` | `app.test.ts`, `security.test.ts` |

The headers are set in `security.ts` rather than with `helmet`: helmet's defaults are made for HTML pages, and an API answering JSON needs only these five.

## Configuration

| Variable | Development | Deployed |
|---|---|---|
| `HOST` | unset: `127.0.0.1` | `0.0.0.0` in a container, so the platform's proxy can reach it |
| `ALLOWED_HOSTS` | unset: local names only | the public host names, comma-separated, without port (`flowboard.example`) |

Express's `trust proxy` is off, so `X-Forwarded-Host` and `X-Forwarded-For` are ignored. Behind the platform's proxy, turning it on is a decision for the deployment: the Host check would then read the forwarded host, which only the proxy may set.

## Accounts

**Data.** A `User` has an email, a name and a password hash. The email is stored trimmed and lowercased, so its unique index ignores case. A board's `Member` links to the user it stands for (`userId`, one member per user and board); deleting an account unlinks its members instead of deleting them, so the name stays on their comments and cards.

**Passwords** (`apps/api/src/auth/passwords.ts`) are hashed with scrypt from `node:crypto`. Argon2id was set aside because its package is native: an install script to allow, binaries to download, a wider supply chain, for an algorithm OWASP ranks alongside scrypt.
- Parameters: N = 2¹⁴, r = 8, p = 5, one of OWASP's equivalent settings, the one using the least memory (16 MiB a hash), so sign-ins at the same moment fit a small server.
- A 16-byte random salt per hash, a 32-byte key, compared in constant time.
- Stored as a PHC string, `$scrypt$ln=14,r=8,p=5$<salt>$<key>`. Each hash carries its parameters, so raising them later still verifies the older hashes, and `needsRehash` marks them to be replaced at the next sign-in.
- Passwords are normalised to NFKC before hashing, so the same password typed on systems that encode accents differently matches.
- A stored hash that is malformed, uses another algorithm, has a short key or names parameters past a cap is refused, never trusted: a tampered row cannot make every password match, or make one sign-in take minutes.

**Sessions** (to come with sign-in): a random token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, and only its SHA-256 hash in the database. The cookie is out of reach of the page's scripts, so an XSS cannot carry it away. Being a row, a session ends when it is deleted: signing out, or changing the password, closes it at once. A JWT was set aside: it stays valid until it expires whatever the server knows, and a web app that keeps it leaves it within reach of scripts.

## Not covered yet

- **Sign-in and permissions** (Roadmap: Collaboration), on the [accounts](#accounts) that exist. Every route will check that the signed-in user is a member of the board the id belongs to, with tests that try to read and write another user's board. Sign-in attempts are limited per account and per address, and an unknown email costs the same time as a wrong password, so the answer does not reveal which accounts exist. Writes also check the `Origin` header.
- **Rate limiting**: none. Sign-in first, then every route, per client.
- **Production** (Roadmap: Production):
  - HTTPS only, with HSTS;
  - a Content Security Policy for the web app's pages;
  - secrets in the platform, never in the image;
  - a database unreachable from the internet, used through a role that cannot change the schema;
  - the API's container running as a user other than root.
