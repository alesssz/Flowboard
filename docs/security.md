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

Flowboard is not deployed. Accounts and sessions exist, but the board, column and card routes do not ask for one yet: whoever reaches the API can read and change every board. Today's defences therefore keep the API reachable only from the computer running it, protect the accounts themselves, and set the rules that still hold once every route needs a session: strict input, JSON-only responses that cannot run as a page, no internals in errors.

## Defences

| Threat | Defence | Where | Checked by |
|---|---|---|---|
| Another device on the network reads or changes the boards | The API listens on `127.0.0.1` only (`HOST`); PostgreSQL publishes its port on `127.0.0.1` | `apps/api/src/index.ts`, `compose.yaml` | `Get-NetTCPConnection -LocalPort 3700 -State Listen` (macOS: `lsof -nP -iTCP:3700 -sTCP:LISTEN`) shows `127.0.0.1` only |
| A web page reaches the local API by DNS rebinding (its own domain pointed at `127.0.0.1`) | The `Host` header must be `localhost`, `127.0.0.1`, `[::1]` or one of `ALLOWED_HOSTS`, else `403`, before the body is read | `checkHost` in `apps/api/src/security.ts` | `apps/api/test/security.test.ts` |
| Another site sends writes from the user's browser (CSRF) | The session cookie is `SameSite=Lax`, so another site's requests carry no session. A write whose `Origin` names another host is a `403`, which also covers sites the browser counts as the same one (a sibling subdomain). No CORS headers: a page from another origin cannot read any answer, nor send `PATCH`, `DELETE` or a JSON body without a preflight the API never grants. A form or `text/plain` `POST` has no JSON body, which every write requires: `400` | `checkOrigin` in `security.ts`, `apps/api/src/auth/sessions.ts`, the request schemas | `security.test.ts`, `auth.test.ts` |
| A response is run, framed or sniffed as a page | Every response is JSON, with `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store` | `setSecurityHeaders` in `security.ts` | `security.test.ts` |
| Malformed, oversized or unexpected input | Request bodies checked against strict Zod schemas: an unknown field is a `400`. Lengths are limited, with the same limits on the web app's inputs. Bodies over 100 kB are a `413`, unread | `@flowboard/shared/schemas`, `apps/api/src/validation.ts`, `app.ts` | `security.test.ts`, each route's tests |
| SQL injection | Queries go through Prisma; the few raw ones are tagged templates, which send every value as a parameter | `apps/api/src/*/…-queries.ts` | code review |
| A card linked to another board's labels, members or columns | Every id in a write is checked against the card's board: `400` | `card-queries.ts` | `cards.test.ts` |
| Script in user text (XSS) | React escapes all text it renders; the web app never sets HTML from data (`dangerouslySetInnerHTML`) | `apps/web/src` | code review |
| A copy of the database gives away passwords or sessions | Only a salted scrypt hash of each password, and the SHA-256 of each session token, are stored ([Accounts](#accounts)) | `apps/api/src/auth/passwords.ts`, `sessions.ts` | `apps/api/test/passwords.test.ts`, `auth.test.ts` |
| Script in the page steals the session | The cookie is `HttpOnly`: scripts cannot read it | `sessions.ts` | `auth.test.ts` |
| A session planted in the browser before sign-in (fixation) | Signing in ends the session the browser held and starts a new one | `startSession` in `sessions.ts` | `auth.test.ts` |
| Passwords guessed by trying many | Failed sign-ins limited per email (10 in 15 minutes), sign-ups and sign-ins per address (100 in 15 minutes): `429` with `Retry-After`. Passwords of at least 15 characters | `apps/api/src/auth/auth-routes.ts`, `rate-limit.ts`, `@flowboard/shared` | `auth.test.ts` |
| Sign-in reveals which emails have an account | A wrong password and an unknown email get the same `401`, and take the same time: an unknown email is checked against a hash too | `auth-routes.ts` | `auth.test.ts` (same answer); timing by design |
| Internals leaked by errors | An unexpected error answers a fixed message, with the details only in the server's log; no `X-Powered-By` | `apps/api/src/errors.ts` | `app.test.ts`, `security.test.ts` |

The headers are set in `security.ts` rather than with `helmet`: helmet's defaults are made for HTML pages, and an API answering JSON needs only these five.

## Configuration

| Variable | Development | Deployed |
|---|---|---|
| `HOST` | unset: `127.0.0.1` | `0.0.0.0` in a container, so the platform's proxy can reach it |
| `ALLOWED_HOSTS` | unset: local names only | the public host names, comma-separated, without port (`flowboard.example`) |

Express's `trust proxy` is off, so `X-Forwarded-Host` and `X-Forwarded-For` are ignored. Behind the platform's proxy, turning it on is a decision for the deployment: the Host check would then read the forwarded host, and the limit per address the forwarded address, which only the proxy may set. Until then, behind a proxy every client shares the proxy's address and its limit.

The session cookie is `Secure`, with the `__Host-` prefix, unless the API is reached over plain HTTP on the loopback, as in development; no setting turns it off elsewhere.

## Accounts

**Data.** A `User` has an email, a name and a password hash. The email is stored trimmed and lowercased, so its unique index ignores case. A board's `Member` links to the user it stands for (`userId`, one member per user and board); deleting an account unlinks its members instead of deleting them, so the name stays on their comments and cards.

**Passwords** (`apps/api/src/auth/passwords.ts`) are hashed with scrypt from `node:crypto`. Argon2id was set aside because its package is native: an install script to allow, binaries to download, a wider supply chain, for an algorithm OWASP ranks alongside scrypt.
- Parameters: N = 2¹⁴, r = 8, p = 5, one of OWASP's equivalent settings, the one using the least memory (16 MiB a hash), so sign-ins at the same moment fit a small server.
- A 16-byte random salt per hash, a 32-byte key, compared in constant time.
- Stored as a PHC string, `$scrypt$ln=14,r=8,p=5$<salt>$<key>`. Each hash carries its parameters, so raising them later still verifies the older hashes, and `needsRehash` marks them to be replaced at the next sign-in.
- Passwords are normalised to NFKC before hashing, so the same password typed on systems that encode accents differently matches.
- A stored hash that is malformed, uses another algorithm, has a short key or names parameters past a cap is refused, never trusted: a tampered row cannot make every password match, or make one sign-in take minutes.

**Sessions** (`apps/api/src/auth/sessions.ts`): a 32-byte random token in a cookie, and only its SHA-256 in the database, as the `Session` row's id.
- The cookie is `HttpOnly` (out of reach of the page's scripts, so an XSS cannot carry it away), `SameSite=Lax`, `Path=/`, and `Secure` with the `__Host-` prefix outside local development: no subdomain can set or read it.
- A session ends after 7 days unused, and 30 days after sign-in however much it is used. Its end is pushed back at most once a day, which saves a write on every request.
- Being a row, a session ends the moment it is deleted: signing out closes it at once, and so will a password change. Ended sessions are deleted when read, and with the user's next sign-in.
- A JWT was set aside: it stays valid until it expires whatever the server knows, and a web app that keeps it leaves it within reach of scripts.

**Sign-up and sign-in** (`apps/api/src/auth/auth-routes.ts`):
- Passwords have 15 to 256 characters at sign-up, NIST SP 800-63B-4's minimum for a password used alone, with no rules on the kinds of characters. Sign-in checks no minimum, so a rule raised later does not lock out older passwords.
- A wrong password and an unknown email get the same answer in the same time. Sign-up still tells that an email is taken (`409`): without email verification there is no other answer to give, and the limit per address slows anyone listing accounts that way.
- The limits are counted in the API's memory, so they hold for one instance and restart with it; several instances would share them through a store such as Redis.

## Not covered yet

- **Permissions** (Roadmap: Collaboration). Every board, column and card route will need a session, and check that the signed-in user is a member of the board the id belongs to, with tests that try to read and write another user's board.
- **Account management**: changing the password (ending the account's other sessions), resetting a forgotten one, verifying the email, deleting the account.
- **Rate limiting** beyond sign-up and sign-in: none yet on the other routes.
- **Production** (Roadmap: Production):
  - HTTPS only, with HSTS;
  - a Content Security Policy for the web app's pages;
  - secrets in the platform, never in the image;
  - a database unreachable from the internet, used through a role that cannot change the schema;
  - the API's container running as a user other than root.
