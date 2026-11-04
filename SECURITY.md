# Security Policy

## Supported versions

Security fixes are provided for the latest minor release of `outlet-orm`.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use GitHub's private vulnerability reporting on the repository
(`Security` → `Report a vulnerability`) and include:

- the affected version and driver (MySQL, PostgreSQL, SQLite);
- a minimal reproduction;
- the impact you believe is possible;
- any suggested remediation.

We aim to acknowledge reports within 72 hours and to publish a coordinated
advisory once a fix is available.

## Security-relevant defaults

- Database TLS can be enabled with `ssl`, `ca`, `rejectUnauthorized`, or
  `DB_SSL=true`. Use it for every network database in production.
- `DatabaseConnection.enableQueryLog()` redacts values for columns whose names
  look like credentials (`password`, `token`, `api_key`, ...), but it should
  still be disabled in production unless needed.
- Backup encryption is opt-in: pass `encrypt: true` and `encryptionPassword`
  to `BackupManager`, and keep backup files outside the web root. New backups
  use the V2 format (16-byte salt, stronger scrypt, HMAC integrity); V1 files
  remain decryptable.
- `BackupSocketServer` binds to `127.0.0.1` by default. If you bind it to a
  non-loopback interface, you must set `authToken` (or `OUTLET_BACKUP_TOKEN`).
- MCP destructive tools require either `OUTLET_AI_CONSENT_TOKEN` or the exact
  human confirmation phrase `I understand the risk and authorize this operation`.
  Never run the MCP server with `safetyGuardrails: false` against production data.
- Raw SQL helpers (`whereRaw`, `havingRaw`, `orderByRaw`, `selectRaw`,
  `executeRawQuery`) are trusted by design. Never interpolate user input into
  them; pass values through bindings.
- The offline mutation queue uses `localStorage`/`sessionStorage`; do not queue
  secrets or sensitive payloads in shared browser profiles.
- `outlet api import --spec <url>` refuses localhost, private, link-local and
  cloud metadata addresses, limits response size, and disables redirects.

## Dependency policy

Dependencies are monitored by Dependabot. CI runs `npm audit --omit=dev
--audit-level=high` and a repository secrets check on every push and pull
request.
