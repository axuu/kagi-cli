## [Unreleased]

### Fixed

- Reject non-relative Kagi settings edit links before sending the session cookie.
- Verify installer downloads against release SHA-256 checksums and keep Unix search history private.
- Require verified signed tags, pinned Actions, and job-scoped write access for releases.

## [0.18.1]

### Fixed

- `kagi usage` no longer rejects valid sessions with an authentication error and parses Kagi's current billing page layout, including the new "AI usage (USD)" cost box (#173).

## [0.18.0]

### Added

- `kagi mcp` now auto-negotiates the wire protocol per request: draft `2026-07-28` requests with `params._meta` metadata keep `server/discover` and cache hints, while requests without it — including `initialize`, `ping`, `tools/list`, and `tools/call` — are answered per the stable MCP specification.
- Added `kagi usage` (`kagi billing`) to report plan, AI cost used and limit, balance, renewal date, and daily calendar-month usage with session-token auth.

## [0.17.2]
