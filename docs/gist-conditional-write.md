# Gist conditional-write gate (ticket #128 / spec #120 D4)

**Status: release blocker. Automatic updates of an existing Gist are not enabled.**

Ticket #128 asked for repeated unattended Gist backups only if a verified write
primitive can stop a competing writer from being overwritten. That primitive has
not been proven, so this repository keeps the existing-Gist automatic path paused
and records the blocker instead of shipping an unsafe PATCH.

## What is shipped

- The unattended first create from #126 is unchanged and still safe: a durable
  `pendingCreate` marker is written before the POST, a lost response stays
  unconfirmed, and an existing/unknown target pauses.
- When a trusted Gist baseline exists, `planGistFirstCreate` returns
  `update-not-enabled` (`gistUpdateNotEnabled`). The background performs **zero**
  PATCH/POST requests in that state. The settings page shows the reason.
- Manual Backup Now still works. In a real extension it now runs inside the
  background queue (`gist-write` message), the same queue as the unattended first
  create, so two tabs and the background cannot write the same Gist at once.
- Manual writes keep their existing user-driven semantics: a confirmed POST
  records a trusted baseline, a confirmed PATCH refreshes it, a lost response is
  reported as unknown and is never retried automatically.

## Evidence reviewed on 2026-11-16

1. GitHub's official OpenAPI description
   (`github/rest-api-description`, `descriptions/api.github.com/api.github.com.json`,
   14,274,007 bytes) has **no** `If-Match` or `If-Unmodified-Since` parameter on
   `PATCH /gists/{gist_id}`. The operation declares only the `gist-id` path
   parameter, an `application/json` request body, and the 200/404/422 responses.
   Across the whole published description, zero operations declare either
   conditional write header.
2. The official "Update a gist" page lists only the `accept` header, `gist_id`,
   `description`, and `files` parameters. Its documented failure responses are
   404 and 422; no 412 precondition response is documented.
   <https://docs.github.com/en/rest/gists/gists>
3. GitHub's conditional-request guidance documents ETag-based `GET` caching and
   `If-None-Match` 304 responses, not an atomic write precondition for PATCH.
   <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>
4. A public GitHub API report shows the write-side behaviour is not a reliable
   precondition: a PATCH with an outdated `If-Match` returned `412` **and still
   updated the resource**. That report is for a pull-request PATCH, not a Gist,
   so it is supporting evidence rather than a Gist measurement.
   <https://github.com/cli/cli/issues/7167>

## Test gap that keeps the gate closed

The ticket requires a real race, not a mocked 412:

1. Read the old Gist version and its ETag.
2. Insert a competing writer's change (a second client or account).
3. Send the backup PATCH with the old condition.
4. Expect the write to be rejected **and the competing content to remain**.

This environment has no valid GitHub credential (the configured `gh` token is
invalid and no SSH key is present), and an anonymous token cannot create or
PATCH a Gist. The race therefore could not be executed against the real GitHub
API. A controlled mock returning 412 is explicitly not accepted as proof.

## Gate to reopen automatic updates

Automatic updates of an existing Gist may be implemented only after all of the
following are recorded in this file:

- a real GitHub account/token (test account, not the user's data) executed the
  four-step race above;
- the competing writer's content survived a rejected conditional PATCH, with
  request IDs, timestamps, and the exact headers used;
- either GitHub documents a supported conditional write for Gist PATCH, or the
  race proves one works atomically;
- the provider-neutral retry/unknown-result rules from #120 D6 are wired to the
  same result path.

Until then the automatic path stays paused, the manual path remains available,
and this ticket must not be marked complete.