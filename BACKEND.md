<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Backend mode

Plinky works today with no server. Backend mode is an optional layer that adds the
few capabilities a browser cannot provide alone — collecting results for a teacher,
comparing a daily run against other people, moving progress between devices,
accepting a submitted score without GitHub. It is additive: with no backend
configured the app behaves exactly as it does now, and every gate still passes.

This document is the design and the implementation plan. It is maintained
alongside the code — see [Maintaining this document](#maintaining-this-document).

**Status: planned. Nothing described here is built yet.**

Revised 2026-08-09 after an adversarial review across security, privacy, platform
limits, architecture fit, sync correctness, referee soundness and operations. That
review changed the design rather than polishing it: the vault gained an identity of
its own and tombstones, several merge policies were wrong in ways that destroyed
data, and the data-residency and retention rules were both wrong.

Also on 2026-08-09, **ranked competition was declined on product grounds** and the
referee that would have supported it went with it. The reasoning is recorded in
[Declined: ranked competition](#declined-ranked-competition) so that the idea does
not return without meeting the argument.

## Contents

- [Scope](#scope)
- [Invariants](#invariants)
- [Platform choice](#platform-choice)
- [Free-tier budget](#free-tier-budget)
- [Topology](#topology)
- [Repository layout](#repository-layout)
- [Client architecture](#client-architecture)
- [Worker architecture](#worker-architecture)
- [Identity](#identity)
- [Capability: result collection](#capability-result-collection)
- [Capability: catalogue submission](#capability-catalogue-submission)
- [Capability: artist pages](#capability-artist-pages)
- [Capability: daily comparison](#capability-daily-comparison)
- [Capability: progress vault](#capability-progress-vault)
- [Capability: the recorded piano](#capability-the-recorded-piano)
- [Declined: ranked competition](#declined-ranked-competition)
- [Deferred: the artist marketplace](#deferred-the-artist-marketplace)
- [Data model](#data-model)
- [Security](#security)
- [Privacy and law](#privacy-and-law)
- [Failure and degradation](#failure-and-degradation)
- [Operations](#operations)
- [Testing](#testing)
- [CI and deployment](#ci-and-deployment)
- [Rollout](#rollout)
- [Decisions](#decisions)
- [Open questions](#open-questions)
- [Maintaining this document](#maintaining-this-document)

> **Sanity is gone (2026-08-13).** Nothing in the app fetches from a third party any
> more: help content ships in the tree, and the board and the news banner were removed.
> [Artist pages](#capability-artist-pages) has been redesigned around that, and keeps a
> short account of the proxy it replaced. Elsewhere — the platform alternatives, the
> decision log — Sanity is named as history and left standing, because this document is
> append-only about decisions and a reader who cannot see an abandoned path will propose
> it again.

## Scope

Five capabilities, each independently shippable and independently switchable.
They are listed in the order the [Rollout](#rollout) builds them.

| Capability | What it adds | Why a browser cannot do it |
| --- | --- | --- |
| Result collection | A pupil's assignment result reaches their teacher without a paste | No shared mutable storage between two devices |
| Catalogue submission | A submitted score arrives without a GitHub account, and a living artist's own music reaches the catalogue | The prefilled-issue URL caps at roughly 8 KB |
| Artist pages | An artist edits their own bio and social links | The client cannot hold a content-store credential without publishing it |
| Daily comparison | A daily run is placed against everyone else's | Aggregation across players requires a common store |
| Progress vault | Progress follows a player between devices | `localStorage` is per-origin, per-device |

Two directions were considered and set aside, each with its reasoning recorded so
that it returns as an argument rather than a suggestion:
[ranked competition](#declined-ranked-competition), declined permanently, and
[the artist marketplace](#deferred-the-artist-marketplace), deferred pending
evidence it is wanted.

Explicitly out of scope, and staying out until separately decided: accounts with
passwords, LTI 1.3, SSO or roster sync, and white-label org configuration. Each
carries obligations far larger than its feature surface, and each is recorded in
the backend ledger rather than here.

Also out of scope: moving the score-ingestion pipeline to the server. `music21`,
MuseScore CLI, Verovio and LilyPond need a filesystem, Python and far more than
10 ms of CPU. Ingestion stays a build-time `dev/*.mts` and GitHub Actions concern;
the backend only ever serves its output.

## Invariants

These hold for every capability, in every phase. A change that breaks one is a
change to this document first.

1. **Offline-first stays true.** Every existing feature keeps working with the
   backend unreachable, misconfigured, or switched off. The backend adds
   capabilities; it never becomes the path through which an existing one runs.
2. **Unconfigured means silent.** With no API base URL in the build, the client
   makes no requests and renders no backend UI — no error surfaced, nothing to
   dismiss. The app already holds this line for everything it fetches: an absent
   catalogue is an empty catalogue, not a broken screen.
3. **A failed fetch degrades to nothing.** No spinner that never resolves, no
   error dialog, no emptied screen. The existing three-layer collapse — transport
   to `null`, adapter to the empty value, hook to its initial state — is the
   pattern.
4. **No streaks, ever.** Backend mode adds comparison and totals. It never adds
   anything consecutive, and never punishes a gap.
5. **Personal data is minimised, and where it exists it is named.** Most
   capabilities are pseudonymous by construction. Result collection is the
   exception: it stores a pupil-chosen display name, which is personal data of a
   child whatever the field is labelled, and the design treats it as such rather
   than claiming an exemption. See [Privacy and law](#privacy-and-law).
6. **Local storage remains the source of truth.** The vault is a copy, never the
   primary. A player who never enables the vault loses nothing, and a vault that
   disappears costs a player nothing they still hold locally.
7. **One grading implementation.** The server never re-implements grading. It
   imports `core/` — the same pure functions the client runs.
8. **Honest labelling.** Every result the server holds was reported to it by a
   device, and is described that way. Nothing is described as verified, proven or
   witnessed, because nothing is. `core/assignmentReport.ts` already states this
   contract for the client-only case, and it does not weaken here.

## Platform choice

Cloudflare, on the free tier. Three reasons, in order of weight.

**The account and the domain are already there.** Preview deploys run on
Cloudflare Pages with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` already
configured as repository secrets, and `wrangler` already runs in `preview.yml`.
The `plinky.fun` zone is on Cloudflare nameservers. A Worker adds no new vendor,
no new billing relationship, and no new credential.

**Zero egress on R2.** Serving scores and progress bundles is almost entirely
egress, which every other object store bills for. R2 bills none of it.

**Durable Objects reach the free plan.** The SQLite-backed variant is on the free
plan, which gives the rate limiter a consistent place to keep a token bucket
without a paid datastore. This was a stronger reason when a
[referee](#declined-ranked-competition) was still planned; the first two reasons
carry the decision on their own.

Alternatives considered and rejected: a small VPS (a machine to patch, back up
and pay for, plus egress); Deno Deploy or Fly.io (comparable free tiers, new
vendor, no existing credential); Supabase or Firebase (a full account system is
the opposite of the no-accounts posture, and the free tiers are the ones most
prone to change); extending Sanity (a content CMS, unsuited to per-run writes —
and since removed from Plinky altogether).

## Free-tier budget

Verified against Cloudflare's documentation on 2026-08-09. Re-verify before each
phase — free-tier terms move, and this table is the assumption the whole plan
rests on.

| Product | Free allowance | Used for |
| --- | --- | --- |
| Workers | 100k requests/day, **10 ms CPU per invocation**, 50 subrequests, 5 cron triggers, 3 MB script | Every endpoint |
| D1 | 5M row reads/day, 100k row writes/day, 5 GB/account, **500 MB/database**, 10 databases, **50 queries per Worker invocation** | Results, comparison, vault index |
| Durable Objects | SQLite backend only, 100k requests/day, 13k GB-s/day, 5M row reads/day, 100k row writes/day, 5 GB | Rate limiting |
| R2 | 10 GB, 1M Class A, 10M Class B, zero egress | Vault blobs, submitted scores |
| Queues | 10k operations/day, 24 h retention (fixed) | Submission moderation nudges |
| KV | 100k reads/day, **1,000 writes/day** | Read-mostly config only |
| Turnstile | Unlimited verifications, 20 widgets | Abuse control on write endpoints |

Six of these numbers drive design decisions rather than merely bounding them.

**KV allows 1,000 writes per day.** It reads like a cache and is unusable as a
write path. No capability here writes to KV. It is listed only so that a future
reader does not reach for it.

**A D1 database caps at 500 MB on the free plan**, with 5 GB across at most ten
databases. Bulk bytes therefore live in R2 and D1 holds rows that point at them.

**D1 allows 50 queries per Worker invocation on the free plan**, and the limit
applies to each statement inside a batch rather than to the batch. Any operation
touching more keys than that must be chunked across requests, which is a protocol
requirement rather than an optimisation. The [vault](#capability-progress-vault)
is the capability this binds.

**An index costs a second row write.** Cloudflare counts index maintenance as an
additional written row whenever a write touches an indexed column. Every index in
the [data model](#data-model) therefore doubles the write cost of its table, and
the budget below counts both.

**10 ms of CPU is per invocation, not per request.** The same ceiling applies to
HTTP requests, cron triggers, queue consumers and alarms. Moving expensive work
"off the request path" buys no CPU at all. Measured on a real catalogue score,
the largest bundled piece is 81 KB compressed and decompresses to 3.7 MB of XML
in roughly 42 ms, after which `core/songId.ts` takes a further 10–13 ms to
fingerprint it. Unzipping and fingerprinting one ordinary score is therefore
about five times the entire budget. No MusicXML decompression, parsing or
fingerprinting happens in a Worker, in any invocation type. Share-card rendering
stays on the client, where it is today.

**The free tier fails closed for Workers and bills for R2.** Exceeding the Worker
request limit returns HTTP error 1027 for the remainder of the UTC day rather
than generating a bill. R2 has no equivalent: it bills overage at $0.015/GB-month
and $4.50 per million Class A operations, Cloudflare publishes no spend cap, and
R2 is the one product requiring a payment method on file. Any R2 write path
therefore needs its own limiter and a billing alert, and the "loss of a capability
rather than a bill" reasoning in [Operations](#operations) applies to Workers
only. Phases 2 and 4 depend on R2; phases 0, 1 and 3 do not.

Estimated consumption at a plausible early scale — 200 daily players, 20 teachers
with 30 pupils each, 50 vault-enabled devices syncing twice a day. D1 writes are
counted after index doubling.

| Source | Requests/day | D1 row writes/day |
| --- | --- | --- |
| Daily comparison (submit + read) | ~400 | ~400 |
| Result collection | ~600 | ~1,200 |
| Vault sync, steady state | ~600 | ~4,000 |
| Health and config polling | ~400 | 0 |
| Total | ~2,000 of 100,000 | ~5,600 of 100,000 |

The vault line assumes a device holding roughly 300 keys — one per single-value
store plus one per piece across six keyed families — of which a few dozen change
between syncs. That is steady state. **First sync is the number that hurts**: a
300-key device uploading everything costs about 600 row writes after index
doubling and spans at least six requests under the 50-query cap, so fifty devices
enrolling on the same day costs roughly 30,000 row writes and crosses the 50%
alert threshold [Operations](#operations) relies on. Enrolment is therefore
rate-limited per day rather than merely per device.

Steady-state headroom is large enough that the first cost concern will be a bug,
an abuser or an enrolment wave rather than organic growth.

## Topology

Production serves from Cloudflare Pages at `plinky.fun` (moved from GitHub Pages on
2026-08-13; the site is still a static build uploaded by `website.yml`, only the host
changed). The API needs a host, and there are two ways to give it one.

**Option A — `api.plinky.fun`, a separate origin.** A Worker on its own subdomain.
Simple, independent of the website deploy, and reversible by deleting a DNS
record. Costs a CORS preflight `OPTIONS` on every non-simple request, and a
preflight is a billable Worker request, so browser API calls roughly double
against the 100k/day allowance.

**Option B — `plinky.fun/api/*`, the same origin.** A Worker route on the apex,
with Pages continuing to serve everything else. No preflights, no CORS
configuration, and cookies would work if they were ever wanted.

Its cost has fallen since this was first weighed. The objection was that same-origin
routing meant putting an apex pointing at GitHub Pages IPs behind Cloudflare's proxy —
a TLS-mode and certificate-validation change to the live site, where a mistake takes
down the website rather than the API. On Cloudflare Pages the apex is already served by
Cloudflare, so that step no longer exists, and the remaining question is only whether
the route belongs to a Pages Function or a Worker. The decision below stands for now,
but its reasoning is weaker than when it was made.

**Decision: Option A for phases 0 to 3, with Option B reconsidered at phase 4.**
The preflight cost is affordable at the volumes above, and the risk profile
differs sharply: Option A cannot break the website, Option B can. Revisit when
either the request budget or the vault's chattier traffic makes it worth the risk,
and treat it as its own change with its own rollback plan.

Environments:

| Environment | Worker | Data | Client reaches it via |
| --- | --- | --- | --- |
| Production | `plinky-api` | D1 `plinky`, R2 `plinky-vault` | `VITE_API_BASE=https://api.plinky.fun` |
| Preview | `plinky-api-preview` | D1 `plinky-preview`, R2 `plinky-vault-preview` | Set per preview deploy |
| Local | `wrangler dev` | Local D1 and R2 emulation | `.env.local` |

Preview and production must never share a database. Preview branches are
disposable and per-branch previews already get distinct origins specifically so
that a preview cannot corrupt real data; the same reasoning extends to the
backend. The preview Worker is a separate Worker with separate bindings, not a
route on the production one.

## Repository layout

A `worker/` directory at the repository root, following the `studio/` precedent —
its own `package.json`, its own `package-lock.json`, its own `tsconfig.json`,
excluded from the root TypeScript project.

```text
worker/
  package.json          # its own dependencies; not the root ones
  tsconfig.json         # @cloudflare/workers-types, no DOM lib
  wrangler.toml         # bindings, routes, environments
  src/
    index.ts            # the fetch handler and router
    routes/             # one module per endpoint
    lib/                # request parsing, responses, rate limiting
    limiter.ts          # the rate-limiter Durable Object
  migrations/           # D1 schema, applied in order
  test/                 # vitest, workerd pool
```

The worker imports `core/` by relative path and nothing else from the repository.
This is the point of the layered architecture paying off: `core/` is already pure,
already free of React and browser globals, and already consumed by `dev/` scripts
and the build config. The server gets the same grading, the same parsers, the same
share codec and the same song-id fingerprint as the client, with no second
implementation to drift.

The dependency direction needs enforcing, because `dependency-cruiser` does not
currently look at `worker/` at all:

```js
{
    name: "worker-points-down",
    comment: "the worker may use core, never the browser app",
    severity: "error",
    from: { path: "^worker/" },
    to: { path: "^app/" },
}
```

and `worker` joins the `depcruise` argument list in the `arch` script. Without
both changes the rule exists and never runs.

## Client architecture

Backend mode adds ports, adapters and stores in the established shape. No
component learns that a backend exists; each receives a capability through the
services context exactly as it receives `news` or `songs` today.

**Ports.** One per capability, in `app/ports/`. Following the house convention,
a single-call capability is a function type and a multi-call one is an object
type named `<Noun>Source` or `<Noun>Sink`.

```ts
// app/ports/resultSink.ts
export type SubmitOutcome = "sent" | "rejected" | "unavailable";

// The seam for handing an assignment report to the teacher's collection point.
// Write-only by construction: a pupil's device can add a result and can never
// read anyone's, so a leaked write token discloses nothing. It still permits
// writing, which is why the teacher can delete a row.
export type ResultSink = {
    submit(classToken: string, report: AssignmentReport): Promise<SubmitOutcome>;
};
```

The three-valued return matters. `KeyValueStore.set` returns a write verdict and
stores pass it through so that a "saved" indicator can gate on it; the same
discipline applies across the network, where the failure is likelier. A caller
must be able to distinguish "the server said no" from "the server was not there",
because the first is worth telling the player about and the second is not.

**Adapters.** In `app/adapters/`, named `plinkyApi<Domain>.ts`, each a
`createPlinkyApi<Domain>(fetchUrl: Fetcher, config: ApiConfig | null = apiConfigFromEnv())`
factory. A shared `app/adapters/plinkyApi.ts` holds the boundary in one place:
config from environment, URL construction, and the single defensive
chokepoint that collapses a network throw, a non-OK status and a malformed body
to one value.

```ts
export function apiConfigFromEnv(): ApiConfig | null {
    const base = import.meta.env?.VITE_API_BASE as string | undefined;
    if (!base) {
        return null;
    }
    return { base, timeoutMs: 10_000 };
}
```

A `null` config is the off switch for the whole of backend mode, enforced at the
one place every adapter derives from. Invariant 2 is a property of this function.

**Fakes.** `fakeResultSink()` and siblings in `app/adapters/`, defaulting to inert
— the same stance `fakeNews(null)` takes.

**Parsers.** Every response body is validated by a pure function in `core/`,
total, never throwing, `unknown` in and `T | null` out. The worker imports the
same function to validate the same shape on the way in. One schema, one
implementation, both directions.

**Stores.** Only where backend state is persistent and shared between views — the
vault's sync metadata, the teacher's own class tokens, and the pupil's set of
class memberships (`plinky:classes`, see
[result collection](#capability-result-collection)). Transient request state lives
in a hook.

**Services.** Each capability is one `AppServices` field, wired in
`createServices` from the shared `fetcher`, and named in `SERVICE_KEY_SET`. The
compiler catches a miss in any of the three places.

## Worker architecture

The same layering, one direction of dependency, for the same reason.

```text
index.ts  ──▶  routes/  ──▶  lib/  ──▶  core/   (core has no outward edges)
                  │
                  └──▶  bindings (D1, R2, DO, Queues) via the env argument
```

A route handler receives `(request, env, ctx)` and hands what it needs to pure
functions. No handler reaches for a binding held in module scope, for the same
reason no component reaches for a singleton: a test supplies the environment.

Every handler follows one shape:

1. Check the method and the route.
2. Enforce the body-size cap by reading `Content-Length` and by capping the read.
3. Parse and validate through a `core/` parser. Reject with 400 on `null`.
4. Check the capability token. Reject with 401 or 404 as
   [Security](#security) specifies.
5. Check the rate limit. Reject with 429 and a `Retry-After`.
6. Do the work — bounded queries, bounded writes.
7. Return a JSON envelope with an explicit schema version.

Responses share an envelope so that a client can distinguish transport failure
from application refusal:

```json
{ "v": 1, "ok": true, "data": { } }
{ "v": 1, "ok": false, "error": "rate_limited", "retryAfter": 60 }
```

Error codes are a closed set — `bad_request`, `unauthorized`, `not_found`,
`rate_limited`, `too_large`, `disabled`, `internal` — and are stable wire
contract. The client maps unknown codes to the same behaviour as `internal`,
so adding a code is not a breaking change.

**CPU discipline.** The 10 ms budget is per request and is not generous. Each
handler declares its worst case in a comment, and the load test in
[Testing](#testing) measures it. Two rules keep handlers inside it: no unbounded
loop over user-supplied data without an explicit cap, and no parsing of a
MusicXML document in a request path. Score validation at submission time is done
by size, extension and a cheap structural check; full parsing happens in the
moderation step, off the request path.

## Identity

No accounts, no passwords, no email addresses. Two mechanisms cover every
capability in scope.

**Capability tokens.** An unguessable random string that grants exactly one
ability on one object. A teacher creating a class gets two: a *write token* their
pupils use to submit, and a *read token* they keep to view results. Knowing the
write token permits adding a result and nothing else — it cannot list, read or
delete. Knowing the read token permits reading that one class.

Tokens are 128 bits from `crypto.getRandomValues`, base64url-encoded, generated
server-side, and stored as a SHA-256 hash so that a database copy does not yield
working tokens. They travel in an `Authorization: Bearer` header.

**A token in a URL is a token that leaks, including in the fragment.** The
fragment is not sent to the origin server, and in this app that is not enough:
the analytics beacon reports the page it is loaded on, so a token left in the URL
can reach a third party on the next page view. The existing share links are also
not the precedent this design first assumed — `core/shareCode.ts` codes travel in
a query string, not a fragment. Both facts point the same way. A link that must
carry a token puts it in the fragment, and the receiving route reads it on mount,
stores it, and calls `history.replaceState` to strip it *before* anything else
runs — analytics included. The fragment is a transport, never a confidentiality
boundary.

**Device keys.** For the vault and the daily histogram, an Ed25519 keypair
generated on the device with Web Crypto, the private key held in `IndexedDB` as a
non-extractable `CryptoKey`.

A public key is an identifier and never a credential. Anyone who sees it can
replay it, so a request authorised by a device presents a signature rather than
the key: `Authorization: Signature <base64url>` over the method, path, body hash,
a server-issued nonce and an expiry, verified by the Worker against the key
registered for that vault. Sending the bare public key as a bearer value would
mean the daily histogram — where the key is deliberately published — hands out
vault credentials.

**One key per capability, derived.** A single device key used across both the
daily histogram and the vault links them to one identifier and turns a pseudonym
into a profile. Each capability therefore gets a distinct derived identifier:
`HMAC(deviceSecret, "<capability>|<scope>")`, so the daily histogram sees one
value, the vault another, and neither can be joined to the other by anyone holding
the database.

**The vault has its own identity.** A vault is addressed by a vault id that is not
any device's key, because a vault keyed by the device that made it is a vault no
second device can ever reach. See [the pairing flow](#capability-progress-vault).

A device key is not a login. Losing every paired device loses the vault, which is
why the vault is a copy rather than the source of truth (invariant 6) and why the
existing progress-bundle file export remains the recovery path.

What this deliberately does not provide: recovery of a lost token, revocation of
a leaked one beyond rotating it, or any way to prove that a person is who they
say they are. Each is an accounts feature, and accounts are out of scope.

## Capability: result collection

The cheapest capability that changes what Plinky can do for a teacher, and the
first one built.

**Flow.** A teacher opens `/class`, creates a class, and receives a write token
and a read token. They share the write token with pupils as part of the existing
assignment link. A pupil finishing an assignment sees an offer to send the result;
sending posts one report. The teacher opens their read link and sees a table.

**Endpoints.**

```text
POST   /v1/class                              → { classId, writeToken, readToken }
POST   /v1/class/:classId/result              Authorization: Bearer <writeToken>
GET    /v1/class/:classId/results             Authorization: Bearer <readToken>
DELETE /v1/class/:classId/result/:submissionId  Authorization: Bearer <readToken>
DELETE /v1/class/:classId                     Authorization: Bearer <readToken>
```

The submitted body is an `AssignmentReport` — the shape
`core/assignmentReport.ts` already defines and already encodes for the paste-based
flow. The wire format is the compact form that module produces, validated by its
existing parser. The paste flow keeps working unchanged; this is a second
transport for the same payload.

**A shared assignment loses its identity today, and phase 1 cannot work until it
keeps one.** `encodeAssignmentLink` drops the local id deliberately — the comment
in `core/assignment.ts` says the receiver assigns its own — and `buildReport` then
stamps that locally minted id onto the report as `assignmentId`. Thirty pupils
doing the same assignment therefore produce thirty different `assignmentId`
values. The paste flow tolerates this because a teacher reads a list and groups it
by eye; a `result` table keyed on `assignment_id` would scatter one assignment
across thirty rows that never join up, which is precisely the table this
capability exists to produce.

The fix is a **teacher-minted assignment id carried through the share code**,
alongside the class id below. The compact wire shape grows from `{n, d?, i}` to
`{n, d?, i, a, c?}` — `a` the stable assignment id, `c` the class it belongs to.
Plinky has no live users, so the format simply changes and the tests change with
it, rather than needing a compatibility path. This is a phase-1 prerequisite and
it lands before any network code.

**A pupil belongs to more than one class, and usually will.** Two music schools is
the obvious case; one school where a pupil takes both piano and theory is the
common one. A device therefore holds a set of memberships, not one:

```text
plinky:classes → { classId, writeToken, label, joinedAt }[]
```

Joining is a per-class act — the teacher shares a join link, the device stores
that membership, doing it twice puts the pupil in two classes. **Submission needs
no choice from the pupil**, because the assignment carries its class id: finishing
an assignment from School A submits to School A's class, and there is no picker to
get wrong. An assignment whose class the device has not joined offers to join
first. An assignment carrying no class at all keeps working exactly as it does
now, through the paste flow, which stays supported for teachers who want nothing
to do with a server.

Leaving a class deletes the membership, which needs a tombstone once the vault
exists so that leaving stays left.

**The parser needs caps it does not have today.** `decodeReport` accepts an
arbitrarily long item list and arbitrarily long `who` and `assignmentName`
strings, which is safe for a paste a human performs and unsafe for an endpoint.
Adding `MAX_REPORT_ITEMS` and length caps to the `core/` parser, with a
`fast-check` property asserting them, is a prerequisite of phase 1 rather than a
hardening step afterwards, and it improves the paste path too.

**Per-result deletion is a requirement, not a nicety.** Thirty pupils share one
write token, so any of them can submit under another's name; the token is a
capability to append, and appending is exactly what it grants. A teacher must be
able to remove a single row, and a pupil must be able to remove their own — the
submitting device keeps its `submissionId` and can present it, which is what makes
an erasure request answerable without an admin path. See
[Privacy and law](#privacy-and-law).

**Deduplication.** A pupil who submits twice should not appear twice. Each result
carries a client-generated `submissionId`, and the row has a unique constraint on
`(class_id, submission_id)`, so a retry after a timeout is idempotent. Without
this, the natural client behaviour on an ambiguous failure — retry — corrupts the
teacher's view.

**Write-only, verified.** The write token grants `POST` only. This is enforced by
storing the two tokens' hashes in separate columns and checking the specific one
per route, rather than by checking membership in a set of valid tokens for the
class. The distinction matters because the second form fails open under a coding
error, and this one fails closed.

**What this does not do.** It does not prove that a pupil played anything. The
report is written by the pupil's device, and a pupil who wants to can write a
better one. `core/assignmentReport.ts` says so today and the UI copy must keep
saying so. What it removes is the transcription step.

## Capability: catalogue submission

**Problem.** Submissions go through a prefilled GitHub issue URL, which caps
around 8 KB. A real MusicXML file exceeds that, and a submitter needs a GitHub
account.

**Flow.** The submitter uses the existing `/library/import` surface, which already
parses and previews the score locally. On submit, the client posts the metadata
and the compressed score in one request. The worker validates size and metadata,
writes the object through its R2 binding, and records a pending row. A maintainer
reviews pending submissions and promotes accepted ones into the catalogue through
the existing `dev/` pipeline and a normal pull request.

**Endpoints.**

```text
POST /v1/submission        Turnstile token required; multipart body ≤ 2 MB
GET  /v1/submission/:id    the submitter's own status, by submission token
```

**The upload goes through the Worker, not through a presigned URL.** A presigned
R2 URL cannot express a maximum object size — R2 does not support presigned POST,
which is the only S3 construct carrying a `content-length-range` policy — and
Cloudflare documents that the same presigned URL can be reused until it expires.
One Turnstile solve would therefore buy a capability to write objects of any size,
repeatedly, for the whole TTL, against the one product that bills rather than
failing closed. A 2 MB body is comfortably inside a Worker request, so routing the
upload through the binding makes the cap real and keeps every write behind the
rate limiter. Presigning would also require S3 API credentials and bucket CORS
that nothing else in this design needs.

**Licence gate, before anything else.** The catalogue is Creative Commons only.
The submission form requires an explicit licence choice from the accepted set
(CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0), a source URL, and an attestation that the
submitter has the right to submit. A submission missing any of these is rejected
at the endpoint rather than in moderation, because a rejected submission that was
never stored carries no obligation. This mirrors the licence-first metadata
discipline the harvest pipeline already applies.

**Size and shape caps.** 2 MB per object, enforced by `Content-Length` and by
capping the read before the write. The extension must be `.mxl` or `.musicxml`.
Structural validation happens in moderation.

**Moderation runs in GitHub Actions, not in a Worker.** Unzipping a score and
fingerprinting it costs roughly 50 ms of CPU on an ordinary catalogue piece
against a 10 ms per-invocation ceiling that applies to cron triggers and queue
consumers exactly as it applies to requests. The Worker therefore stores bytes and
metadata and does nothing else with them. A scheduled Actions job pulls pending
objects from R2 and runs the real work in the environment that already has Node,
`linkedom` and no CPU ceiling — the same argument that keeps score ingestion out
of the backend entirely. Queues carries the nudge that a submission is waiting,
which is all its 10k operations/day is spent on.

**Deduplication.** `core/songId.ts` is a content fingerprint over the note
sequence, pure and dependency-free. The client computes it and sends it, and the
moderation job recomputes it from the stored bytes — in Actions, where the CPU
exists. A client-supplied id is a hint for early duplicate feedback and is never
trusted; the recomputed id is what decides. An id already in the catalogue is a
duplicate, rejected with a pointer to the existing piece.

**An upload nobody completes is still an object that bills.** Pending submissions
older than 24 hours are deleted with their objects by the scheduled sweep, and the
sweep also reconciles the R2 prefix against the table so that an object with no
row is collected. Objects are deleted before the rows that name them: a row
pointing at a missing object is recoverable, an object no row names is not.

**Human review is mandatory.** Nothing a stranger uploads reaches the catalogue
without a maintainer accepting it. This is a licensing requirement rather than a
quality preference, and it is also what keeps the project outside the
user-generated-content liability regime described in the backend ledger.

**Living artists publishing their own music is the same endpoint plus an
attribution.** A submission may name the artist it belongs to, and at review time
the maintainer links it to that artist's page. Nothing new is needed to decide
whether the artist is really who they say: the maintainer already curates who
appears on the board, and that curation is the verification. No claiming flow, no
identity service, no accounts.

What this gives an artist is a page on Plinky listing their own pieces, playable
by anyone, credited and licensed under the CC terms they chose. What it gives the
catalogue is music that exists nowhere else. The licence gate above is unchanged —
an artist publishing here is choosing CC0, CC-BY or CC-BY-SA for that piece, which
is a real decision and must be presented as one rather than buried in a checkbox.

Selling is a different proposition entirely and is
[deferred](#deferred-the-artist-marketplace).

## Capability: artist pages

**Most of this needs no backend, and that half should ship first.** `/person/:slug`
is generated entirely from the catalogue — `personFor(bundledPieces(), slug)`
canonicalises composer spellings and lists that person's pieces. What it cannot show
is the person: a photo, a blurb, where to follow them.

That belongs in the catalogue, beside the music it describes. A profile is a file in
the repository — a slug, a blurb per language, a picture, and a short list of
`{label, url}` links, since an artist will want Instagram and YouTube and Bandcamp
rather than one of them. The build folds them into the people index the person page
already reads, so a page with no profile is exactly today's page and a page with one
gains a header. **No server is involved, it works offline, and the profile a reader
sees is the one that shipped with their build** — the same properties the help page
gained when its content moved in-tree.

**The backend is only needed so an artist can change it without a maintainer typing
it in.** That is the [catalogue submission](#capability-catalogue-submission) path,
not a second mechanism: a profile edit is a submission like a piece is, it lands in
the review queue, and a maintainer merges it. The decision that living artists
publish through submission and curation was already taken for their music; their
profile is the same act with a smaller payload.

So there is no artist-editing endpoint, no scoped write token, no field whitelist and
no link allowlist to maintain. The moderation surface an editable public profile
would open on a site children use closes with it: nothing an artist writes is live
until a person has read it. What the Worker carries is one more submission kind.

**Superseded design, kept because it will otherwise be proposed again.** Until
2026-08-13 the artist record was a Sanity document behind `/board`, and this section
designed a Worker that proxied a scoped patch into Sanity's mutate API — a per-artist
edit token, a server-side field whitelist, an allowlist deciding which links published
immediately and which queued for review, and revocation by rotating the token. Studio
logins had been rejected because the free plan's roles could not confine an editor to
one document. All of it rested on there being a live CMS to patch. Sanity is gone from
Plinky entirely, `/board` with it, so the proxy has nothing to proxy; the machinery
listed above went with the store it guarded, not because it was wrong.

**Consent works here in a way it does not for pupils.** An artist is an adult asking
for a public profile, so consent is freely given and valid, and the obligations are
ordinary: name the processing in the privacy policy and offer removal on request.
This capability carries none of the phase-1 blockers in
[Privacy and law](#privacy-and-law).

## Capability: daily comparison

**Flow.** The daily challenge is already deterministic from the date —
`core/daily.ts` seeds a mulberry32 PRNG from a hash of the date key and
explicitly never uses the device's catalogue, so every player gets the same
challenge and a server can compute it independently. After a daily run, the
client offers to submit the result. The response carries the distribution so far,
and the client renders where the player landed.

**Endpoints.**

```text
POST /v1/daily/:dateKey/result   → { count, distribution, yourBand }
GET  /v1/daily/:dateKey          → { count, distribution }
```

**What is submitted.** The grade letter, the note counts, and the daily-scoped
derived identifier from [Identity](#identity). No name, no free text, and not the
raw device key. The response is a histogram over grade bands and a total — the
same five bands the share grid already uses — never a list of players.

**The response says which band, never which rank.** An earlier draft returned
`yourRank`, which is a leaderboard by another name and contradicts the paragraph
below it. The band is what the histogram needs to highlight the player's bar.

**`dateKey` is bounded server-side.** `core/daily.ts` computes it from the
device's local date, so a server cannot derive it exactly, and an unbounded key
lets one client write a row for every date in history. The endpoint accepts a key
within one day either side of the server's UTC date and rejects anything else,
which covers every real timezone.

**One result per identifier per day**, by unique constraint on
`(date_key, submitter)`.
A second submission replaces the first only if it is a better grade, so a player
who runs the daily twice sees their best and the histogram does not double-count.

**Identifiers are self-minted, so the histogram is robust rather than exact.**
Nothing stops a script generating fresh keypairs and voting; the defence is not to
make that impossible but to make it pointless and cheap to absorb. Turnstile gates
the submit endpoint, new identifiers are rate-limited per IP prefix per day, and
the histogram is presented as an approximate shape rather than an authoritative
count. A skewed histogram is a cosmetic problem; the same script filling the table
is a budget problem, which is what the rate limit is actually protecting.

**Everything here is reported, and the copy says so.** The histogram is a
comparison against what other people said they scored. That is worth something
socially and nothing competitively, and the interface must not imply otherwise.
There is no verified tier to graduate to: ranked competition is
[declined](#declined-ranked-competition), permanently.

**Product check.** Comparison against other players is adjacent to the competitive
framing invariant 4 exists to avoid, so the line matters. A histogram showing
"most people landed here" is encouragement and belongs. A ranking showing who is
above you is pressure and does not. This capability builds the histogram only, and
that is the whole of comparison in Plinky.

## Capability: progress vault

The highest-risk capability in the document, because it is the only one that can
destroy data a player already has.

**The problem with the obvious design.** The existing progress bundle is a flat
map of `plinky:`-prefixed key to raw stored string, and `importProgress` applies
it by writing every entry and then deleting every key not in the bundle. Replace
rather than merge is exactly right for the file-based device handoff it was built
for — a piece you deleted before backing up does not come back to life. It is
catastrophic as a sync primitive. Two devices, each pushing a whole bundle and
pulling a whole bundle, means the last device to sync silently erases everything
the other did since its own last push.

**Consequence: the bundle format is not the sync format.** Sync needs per-key
versioning, which the current format has no room for, and a merge policy per
store, which a flat string map cannot express.

**A vault is not a device.** A vault has its own id, minted when a player enables
the feature, and devices *join* it. Keying the vault on the device that created
it — as an earlier draft did — makes the capability impossible by construction:
a second device generates an unrelated keypair, addresses a different row space,
and can never see the first device's data. The pairing flow is therefore part of
the design rather than a detail:

1. Device A enables the vault. The server mints a vault id and registers A's
   public key as its first member.
2. A displays a join code — a short-lived, single-use capability token, shown as
   text and as a QR code.
3. Device B presents the join code and its own public key. The server registers B
   as a member and burns the code.
4. Both devices sign their requests with their own keys. Membership, not key
   ownership, is what authorises access.

Members are rows in `vault_member`, and a device can be removed from the vault by
any member, which is the only revocation the design offers.

**Sync unit.** One row per storage key per vault, carrying a merge clock, a
content hash and a tombstone mark:

```text
(vault, key, value, blob_key, hlc, hash, deleted, rev)
```

`rev` is a per-vault monotonic counter assigned by the server on write. A client
pulls everything with `rev > lastSeenRev`, which makes sync incremental and makes
a resumed sync cheap.

**The merge clock is logical, not wall-clock.** Every timestamp Plinky stores
today comes from `Date.now()` — `Take.createdAt` is documented as wall-clock,
and `Mastery.updatedAt`, `SightReadRecord.playedAt` and `PlacementResult.takenAt`
are the same. A device with a clock three days fast would win every comparison
forever: the player changes a setting on the phone, the next sync silently reverts
it from the tablet, they change it again, it reverts again, with nothing on screen
to explain why. `hlc` is therefore a hybrid logical clock —
`max(local wall clock, highest clock seen from any member) + 1` — which preserves
causality regardless of skew. `hash` is the deterministic tie-break when two
clocks are equal, without which last-write-wins is not commutative. The document
already refuses to trust a client clock for `reported_at`; the merge decision
variable deserves the same suspicion.

**Deletion needs tombstones, or nothing can ever be deleted.** Plinky deletes in
five places today: clearing a fingering map, removing a take, removing an
assignment, un-starring a favourite, and deleting an imported score. Under a merge
that treats absence as "not yet seen", every one of them is undone by the next
sync from a device that still holds the value — a deleted take returns, and
returns again each time it is deleted, forever. A deletion is therefore a
first-class mergeable value: `deleted` with its own clock, beating an older live
value and losing to a newer one. Collection-valued keys need the same treatment
per element, which makes them OR-Sets rather than plain unions. Tombstones are
collected 90 days after the last member syncs past them, which is bounded by the
365-day vault retention below.

**Merge policy is per store, and it is the real work.** Last-write-wins is wrong
for most of what Plinky stores. The policy table is part of the design, not an
implementation detail:

| Key or family | Merge | Reason |
| --- | --- | --- |
| `plinky:prefs` | Field-wise LWW, minus a do-not-sync list | One object, ~35 fields; whole-object LWW discards a concurrent edit to a different field |
| `plinky:theme` | Not synced | Device-scoped: a phone and a desktop legitimately differ |
| `plinky:discovered`, `plinky:seen-hints` | Set union | Genuinely grow-only; both stores only ever add |
| `plinky:favorites` | OR-Set with per-id tombstones | The only mutator is a toggle that *deletes*; plain union means the star list can never shrink |
| `plinky:mastery:<id>` | Field-wise: `max` on `bestScore`, LWW on `learned`, LWW on `backlog`, LWW on `intervalDays`/`reviewAt` | `learned` and `backlog` are reversible toggles, so `or` would make un-marking impossible |
| `plinky:history` | Per-day `max` | Each day's note count is a total; the larger reflects more practice |
| `plinky:lifetime` | Per-date field-wise `max`, cap at 14 after merge | Days hold a path-dependent average, so only a per-field rule is well defined |
| `plinky:notestats` | Per-device lanes, summed at read | Absolute lifetime totals; summing two snapshots is not idempotent and doubles on every re-sync |
| `plinky:takes:<id>` | OR-Set by take id, **no cap applied on merge** | A recording is the only value that cannot be re-derived; capping the union at 5 destroys recordings |
| `plinky:ghost:<id>` | LWW on the merge clock | It holds the last complete run, which may be a deliberately adopted friend's ghost, so "keep the faster" would silently delete it |
| `plinky:sectionbest:<id>` | Element-wise `max` | Per-section bests |
| `plinky:sightread:<id>` | Keep the one with the lowest server `rev` | It records a first read; ordering by client `playedAt` lets a skewed clock install a practised re-read as the true one |
| `plinky:daily-done` | `max` | A forward-only counter |
| `plinky:daily-result` | Keep the higher `number`, tie-broken by better grade | Scoped to one day; the store is forward-only |
| `plinky:placement` | LWW on the merge clock | A deliberate one-off test; the latest taking is the current one |
| `plinky:reached-grade` | `max` | Forward-only milestone |
| `plinky:flawless-done` | `or` | A genuinely one-way achievement |
| `plinky:assignments` | LWW-map by assignment id, with tombstones | `save()` is an upsert, so one id legitimately holds different bodies on two devices; `remove()` exists |
| `plinky:classes` | OR-Set by class id, with tombstones | A pupil joins several classes and leaves them; leaving must stay left. Carries a write token, so see the note below |
| `plinky:fingering:<id>` | LWW-register per finger key, whole-map tombstone on `clear()` | Whole-map LWW discards an entire hand of hard-won per-note edits |
| `plinky:scores` | OR-Set by song id, R2-backed | See below |

**An unlisted key is refused, never guessed.** A key with no row does not sync,
and the client surfaces that it was skipped. A gate in the spirit of
`npm run tokens` and `npm run messages:check` fails the build when a `plinky:`
key exists in the app with no policy in this table, so the table cannot silently
fall behind the stores. Three keys were missing from the first draft of this
table, which is the argument for the gate.

**Do-not-sync list.** `micCalibration`, `barsPerRow` and
`noteScale` are documented in `core/prefs.ts` as per-device, and syncing them
pushes one room's tuning onto another piano and a phone's layout onto a desktop.

**Class memberships carry a credential, which is a deliberate trade.**
`plinky:classes` holds write tokens, so syncing it puts them in the vault in
plain text. Syncing is still the right call: a class write token grants only
"append a result to this one class", it is already shared with everyone in the
room, and the alternative is making a pupil re-join every school on every device.
The trade is recorded rather than assumed, and it is the reason a vault deletion
also revokes nothing — a member leaving a class must delete the membership, not
merely stop syncing.

**Every merge function is pure**, lives in `core/vaultMerge.ts`, and is
property-tested for the three laws that make repeated sync safe: idempotence
(merging a value with itself changes nothing), commutativity (device order does
not matter), and associativity (batching does not matter). Idempotence is the law
that catches the most errors — a field-wise sum fails it by construction, which is
how the `notestats` row above was caught — so it is asserted for every policy
without exception. Without all three, sync converges to different states on
different devices depending on order, and the bug appears as slow unexplained data
loss. `fast-check` is already in the repository and this is the strongest case for
it in the codebase.

**Caps are applied locally, never during merge.** The takes cap of 5 and the
lifetime cap of 14 days are domain rules about what one device keeps. Applying
them to a merged set is destructive and not associative: a player with five takes
on a laptop and five on a phone would lose five recordings on first sync, and the
cap has no total order to apply anyway, since `takesStore` caps by insertion order
while `createdAt` is a skewable wall clock. The vault holds the union; the device
displays and prunes what it chooses.

**Endpoints and concurrency.**

```text
POST   /v1/vault                  → { vaultId }            first device
POST   /v1/vault/:id/join         join code + public key   subsequent devices
POST   /v1/vault/:id/push         batch of ≤ 40 entries, conditional on rev
GET    /v1/vault/:id/pull?since=  batch of ≤ 40 entries + nextSince
DELETE /v1/vault/:id              erases the vault and its blobs
```

The merge runs on the server, which is the only place that sees both sides. A
push is conditional on the `rev` the client last saw, and a mismatch returns the
entries it missed so the client re-merges and retries — without that, two devices
pushing the same key concurrently lose one write silently.

**Sync is chunked, resumable, and never half-applied locally.** D1 permits 50
queries per Worker invocation on the free plan, so a device holding a few hundred
keys cannot push in one request. Batches are capped at 40 entries, a sync is a
sequence of requests, and the client applies nothing to local storage until the
whole pull completes. An interrupted sync resumes from `lastSeenRev`.

**Large values go to R2.** `plinky:scores` holds full MusicXML text per imported
score, unbounded in count and size, and it is the one key that would blow both the
D1 row limit and the 500 MB database. Scores are stored at
`vault/<vaultId>/<songId>`. Deduplication is **within a vault**, not across
devices globally — a per-vault prefix is what keeps one player's imports out of
another's namespace, and content-addressing across vaults would need a refcount
table and a shared deletion story that this design does not want. The score's own
metadata (title, tempo, licence) stays in the D1 row, since an object keyed by a
content fingerprint cannot carry per-player fields.

**Interaction with the two existing recovery paths.** Both are destructive
operations the vault would otherwise undo, and both must become vault-aware:

- `resetDevice()` wipes every `plinky:` key locally. With the vault enabled it
  must first leave the vault, so nothing is pulled back. "Start over" that
  silently restores everything is worse than no reset at all.
- `importProgress()` writes a bundle and then prunes every prefixed key the bundle
  does not contain — the step its own source comment calls what makes it a restore
  rather than a merge. With the vault enabled it must push a tombstone for every
  key it prunes and advance the merge clock on every key it writes, so the
  restored state wins. Otherwise a restore produces neither the backup's state nor
  the vault's.

Both interactions are phase-4 exit criteria with their own tests.

**Sizing.** A device holds roughly one key per single-value store plus one per
piece across six keyed families — a few hundred rows for an active player, each
costing two D1 row writes because of the `rev` index. Steady-state sync is cheap;
first sync is not, which is why enrolment is rate-limited. Takes dominate stored
bytes once a player records, since each holds up to five compressed compositions
per song.

**Enabling is explicit.** The vault is off until a player turns it on in Settings
and is off by default forever otherwise. Turning it on explains, in plain
language, what leaves the device.

**Recovery stays local.** The existing file-based backup and restore remains the
supported way to move a device and the supported way to recover. The vault is a
convenience layered on top of it, and it is designed so that its worst failure
costs a player nothing they still hold locally.

## Capability: the recorded piano

**Live as of 2026-08-16, and not a backend.** The recorded grand piano is static bytes on
object storage, no Worker, no state, no identity — the first thing Plinky serves from
anywhere but its own origin. It is recorded here because it is the first non-Pages origin
and because the next person to add one should find the reasoning.

The instrument is the Salamander Grand Piano V3 by Alexander Holm, CC-BY-3.0: 29 sampled
keys on a minor-third grid, sixteen velocity layers each, plus key-off noises and string
resonances. Encoded to Opus at 96 kb/s it is 621 files and about 82 MB — and **nobody
downloads that.** Each recording is its own URL, a piece asks for a couple of dozen of
them, and the app knows which before it plays a note, so the cost that matters is a
session. Measured across the catalogue, grade 1 to grade 8:

| what | files | fetched |
| --- | --- | --- |
| a first study | 3 | 0.4 MB |
| a grade 4 piece | 15 | 2.9 MB |
| a grade 8 piece | 24 | 4.2 MB |
| sixteen pieces, every grade | — | **4.8 MB in total** |

The curve flattens almost at once, because pieces reuse the same recordings. That is why
there is no download button, no progress bar and no quality tier: the instrument arrives
while somebody plays, and a recording that has not arrived is a note the synthesised voice
plays. **A note-on never waits** — the port's `bufferFor` is synchronous and answers null,
which is what makes all of the above safe.

### The bucket

An R2 bucket, `plinky-samples`, published read-only at `samples.plinky.fun`. R2 has no
egress charge, which is the whole reason it is R2 rather than anything else: this is a
read-mostly pile of immutable audio served to browsers.

The path carries a version — `/v1/…` — and **a published version is immutable**. Every
recording is cached by URL on the player's device; a re-encode under an unchanged name is
the one change a cache cannot notice. A new encoding is `/v2/`, and the client's base URL
moves with it.

Setting it up, once:

1. **Create the bucket.** Cloudflare dashboard → R2 → *Create bucket*, named
   `plinky-samples`, in the automatic location. Leave it private for now.
2. **Build the pack**, with the library unpacked somewhere outside the repository:
   `npm run piano:build -- --library <dir> --out piano-pack`. It writes
   `piano-pack/v1/` — 621 `.opus` files, a `manifest.json` carrying the licence, and a
   `README.txt` beside it with the credit and the byte count.
3. **Upload it** under the same `v1/` prefix. The dashboard refuses more than a hundred
   files at a time and a pack is six hundred, so `npm run piano:upload -- --bucket
   plinky-samples` drives wrangler once per object, eight at a time, and remembers what
   landed so a dropped connection costs only the rest. It needs `CLOUDFLARE_ACCOUNT_ID`
   and `CLOUDFLARE_API_TOKEN` in the environment — an R2 token with object read/write on
   this bucket alone — and never takes them as arguments, because a token on a command
   line ends up in shell history.

   By hand it is `npx wrangler r2 object put plinky-samples/v1/<name> --file <path>
   --remote`. **`--remote` is not optional**: without it wrangler writes to a local
   simulator and reports success. Upload `manifest.json` **last** — while it is absent the
   app has no pack at all, which is a better half-uploaded state than a manifest naming
   recordings that have not arrived. Serve the audio as `audio/ogg` and everything with
   `cache-control: public, max-age=31536000, immutable`.
4. **Give it a domain.** Bucket → *Settings* → *Public access* → *Custom domain* →
   `samples.plinky.fun`. Cloudflare adds the DNS record itself when the zone is on the
   same account. Do **not** enable the `r2.dev` public URL: it is rate-limited and its
   hostname would end up in a cache somewhere.
5. **Allow the app to read it.** Bucket → *Settings* → *CORS policy*: `GET` and `HEAD`
   from `https://plinky.fun` and the preview origin, no credentials. Without this the
   fetches fail as CORS errors even though the objects are public.
6. **Cache it hard.** A Cache Rule on `samples.plinky.fun/*` with an edge TTL of a year
   and *Respect origin* off. The bytes are immutable by construction, so nothing here can
   go stale. Objects uploaded through the dashboard carry no `cache-control` of their own
   — `npm run piano:upload` sets one, the dashboard does not — so without the rule every
   recording is revalidated on each visit. It still works, because the app keeps its own
   copy in Cache Storage; it is just paid for twice.

Then **check it**: `npm run piano:verify` asks the origin about every object the manifest
names, compares each size with what was built, and reads the headers a browser will need.
An upload of six hundred objects fails partially and quietly — a few time out, the manifest
lands anyway, and the app plays a synthesised note wherever a recording is missing, which
sounds like nothing being wrong.

Nothing in CI touches the bucket. The pack is built and uploaded by hand when the
instrument changes, which — for a library published in 2016 — is close to never.

### What is owed

CC-BY means the credit is a condition, not a courtesy. `manifest.json` carries the
instrument, the author, the licence and the source; `core/sampledPiano.ts` renders it, and
Settings shows it under the switch whenever the recorded piano is on. A pack that travels
without its licence is a pack that cannot ship.

## Declined: ranked competition

**Plinky will not have ranked competition, and therefore will not have a
server-side referee.** Decided 2026-08-09. The reasoning is about what Plinky is
for: a ladder ranks players against each other, and ranking is a form of pressure
that the rest of the product deliberately refuses. Invariant 4 already rules out
streaks because they punish a missed day. A ladder is the same instinct wearing a
different hat, and the friendliness Plinky promotes is worth more than the
engagement a ranking would buy.

This section stays because the analysis is worth keeping. Without it, the idea
returns — a referee is an appealing thing to design, and its problems are not
obvious until some way in.

**A referee could not have made results trustworthy in any case.** Grading is pure
and deterministic: `matcher` → `runCapture` → `rhythm`/`flow`/`dynamics` →
`deriveRunOutcome` → `computeGrade` yields a bit-identical grade from the same
inputs, with no `Date.now`, `Math.random` or `performance.now` in the chain. So a
server could replay a submitted stream and reproduce the verdict exactly — and
prove nothing by it, because the client authored the stream. **Reproducibility of
a verdict is not authenticity of a stream**, and a design that conflates the two
buys a database table and calls it integrity. Streaming events in real time and
choosing the parameters server-side would raise an attacker's cost from editing a
number to writing a real-time bot, which is a genuine increase and still not a
proof. A bot that plays in real time with human-like timing noise is
indistinguishable from a human at the MIDI-event level, and no server-side scheme
changes that.

**The server also has no answer key.** Grading needs `MatchStep[]` — the
ground-truth pitches and notated onsets a run is matched against — and `core/`
does not produce it. It is lifted off a rendered OpenSheetMusicDisplay instance by
walking `osmd.cursor` in `app/hooks/useScoreMatcher.ts`, and OSMD engraves into a
DOM that workerd does not have. `core/musicxmlParse.ts` is no substitute: it needs
an injected `XmlCodec` backed by `DOMParser` or `linkedom`, and yields a
`Composition` rather than a step model. Taking the step model from the client
would let an attacker supply both the answer key and the answers. Any future
server-side grading — for any purpose, not only a referee — has to solve this
first, either by extracting a pure DOM-free step-model builder into `core/` or by
restricting itself to pieces `core/drill.ts` generates programmatically.

**What survives into the shipped design.** Honest labelling, in invariant 8: a
result the server merely received is described as reported, and nothing is ever
described as verified. The [daily comparison](#capability-daily-comparison) is a
histogram of what people said they scored, presented as an approximate shape and
never as a ranking. `core/assignmentReport.ts` already carries the same contract
for the client-only case, and it does not weaken.

## Deferred: the artist marketplace

**Letting artists sell their music through Plinky is deferred, not declined.** The
idea is sound and the demand is plausible. What stops it being a phase is that its
obligations are the substance of the feature rather than a long tail, and that the
one fact which should decide it — whether living artists actually publish here at
all — will be known for free once
[catalogue submission](#capability-catalogue-submission) ships.

**What selling would require**, none of which is optional: Stripe Connect and
payouts; EU VAT on digital goods charged at the buyer's destination, with the
registration and filing that implies for a German operator; DSA intermediary
duties; notice-and-takedown, because somebody will eventually upload work they do
not own; content moderation at a volume curation cannot absorb; refunds,
chargebacks and tax reporting; and a contributor agreement carrying a warranty and
an indemnity. Together these convert Plinky from a curated publisher into a
marketplace, which is a different liability regime and a materially different
amount of one person's time.

**Two collisions are specific to Plinky and make it harder here than in general.**

*A paid piece has to be export-locked, and the app promises the opposite.*
Progress backup, MIDI and MusicXML export and share links exist because a player
owns what they have. Withholding bytes already delivered to a browser is not
possible, so a paid catalogue needs gated per-piece delivery and still breaks the
promise for anyone who looks.

*It needs a second, non-CC catalogue track.* The catalogue's entire policy is
Creative Commons only, with attribution and reuse following from that. Sold work
would carry different rules for export, attribution and takedown, sitting beside
it and requiring every piece of catalogue tooling to know which kind it is
holding.

**Why publishing first costs nothing in optionality.** Artists selling requires
artists publishing, so the free version is the first step of the paid one whatever
is decided later. Shipping it answers the question that matters — do living
artists want to be here — before any of the obligations above are taken on. If the
answer turns out to be no, nothing was spent finding out.

## Data model

D1 schema, applied through numbered migrations in `worker/migrations/`. Every
table carries an explicit `created_at` and every table with user-supplied content
carries a retention basis.

**Create every database and bucket with `--jurisdiction=eu`, in phase 0.** D1 and
R2 both support an EU jurisdiction that guarantees data stays in the region, and
both accept it **only at creation** — it cannot be added or changed afterwards.
Getting this wrong is the one genuine one-way door in the plan: a database created
without it can only be fixed by creating a second one, copying the data and
swapping a binding on a live API. It applies to preview as much as production,
because preview databases receive real payloads during testing. A jurisdictional
R2 bucket is also addressed through a jurisdiction-specific S3 endpoint host,
which any tooling that talks to it directly must build correctly.

```sql
-- Classes: a teacher's collection point. No teacher identity is stored.
CREATE TABLE class (
    id              TEXT PRIMARY KEY,       -- random, 128-bit, base64url
    write_token_hash TEXT NOT NULL,         -- SHA-256; grants POST result only
    read_token_hash  TEXT NOT NULL,         -- SHA-256; grants GET results only
    label           TEXT,                   -- optional, teacher-chosen, non-personal by request
    created_at      INTEGER NOT NULL,
    last_active_at  INTEGER NOT NULL,       -- bumped by a read OR a write; a submission proves life
    hard_expires_at INTEGER NOT NULL        -- created_at + 400 days; no activity extends past this
);

-- One submitted assignment report.
CREATE TABLE result (
    class_id        TEXT NOT NULL REFERENCES class(id) ON DELETE CASCADE,
    submission_id   TEXT NOT NULL,          -- client-generated; makes retry idempotent
    who             TEXT NOT NULL,          -- pupil-chosen display name; see Privacy
    assignment_id   TEXT NOT NULL,
    assignment_name TEXT NOT NULL,
    items           TEXT NOT NULL,          -- JSON [[itemId, score], …]
    reported_at     INTEGER NOT NULL,       -- client clock; display-only, never trusted
    received_at     INTEGER NOT NULL,       -- server clock; the ordering key
    PRIMARY KEY (class_id, submission_id)
);
CREATE INDEX result_by_class ON result(class_id, received_at DESC);

-- Daily comparison. Aggregate-only by construction: no name column exists.
CREATE TABLE daily_result (
    date_key        TEXT NOT NULL,          -- YYYY-MM-DD, bounded to ±1 day of the server's UTC date
    submitter       TEXT NOT NULL,          -- the daily-scoped derived identifier, never the raw device key
    letter          TEXT NOT NULL,          -- the grade band
    score           INTEGER NOT NULL,
    received_at     INTEGER NOT NULL,
    PRIMARY KEY (date_key, submitter)
);
CREATE INDEX daily_by_date ON daily_result(date_key, letter);

-- Vault: an id of its own, so that more than one device can reach it.
CREATE TABLE vault (
    id              TEXT PRIMARY KEY,
    next_rev        INTEGER NOT NULL,       -- monotonic counter handed out on write
    created_at      INTEGER NOT NULL,
    last_sync_at    INTEGER NOT NULL
);

-- Devices that have joined a vault. Membership authorises, key ownership proves.
CREATE TABLE vault_member (
    vault           TEXT NOT NULL REFERENCES vault(id) ON DELETE CASCADE,
    device_pubkey   TEXT NOT NULL,          -- Ed25519, base64url; verifies request signatures
    joined_at       INTEGER NOT NULL,
    PRIMARY KEY (vault, device_pubkey)
);

-- One row per storage key per vault.
CREATE TABLE vault_entry (
    vault           TEXT NOT NULL REFERENCES vault(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,          -- bare key, plinky: prefix stripped
    value           TEXT,                   -- raw stored string; NULL when R2-backed or deleted
    blob_key        TEXT,                   -- R2 object key when the value is large
    hlc             INTEGER NOT NULL,       -- hybrid logical clock; survives device clock skew
    hash            TEXT NOT NULL,          -- content hash; the tie-break when clocks are equal
    deleted         INTEGER NOT NULL,       -- tombstone; a deletion is a value, not an absence
    rev             INTEGER NOT NULL,       -- server counter, for incremental pull
    PRIMARY KEY (vault, key)
);
CREATE INDEX vault_by_rev ON vault_entry(vault, rev);

-- No artist table. Profiles live in the repository and change through the submission
-- queue like any other contribution, so there is no per-artist edit token to store and
-- nothing for the Worker to authorise. The table that stood here held the scoped
-- credential for patching a Sanity document; both are gone.

-- Catalogue submissions awaiting review.
CREATE TABLE submission (
    id              TEXT PRIMARY KEY,
    song_id         TEXT,                   -- core/songId.ts fingerprint, set at moderation
    object_key      TEXT NOT NULL,          -- R2 key of the uploaded score
    title           TEXT NOT NULL,
    composer        TEXT,
    artist_id       TEXT REFERENCES artist(id),  -- set when a living artist publishes their own work
    licence         TEXT NOT NULL,          -- SPDX id from the accepted set
    source_url      TEXT NOT NULL,
    submitter_note  TEXT,
    state           TEXT NOT NULL,          -- 'pending' | 'accepted' | 'rejected'
    created_at      INTEGER NOT NULL
);
```

Retention, enforced by a scheduled Worker (one of the five free cron triggers):

| Table | Retained | Then |
| --- | --- | --- |
| `class` | 180 days from last activity, read **or** write; never past 400 days from creation | Deleted, cascading |
| `result` | 180 days from its own `received_at`, independent of the class | Deleted |
| `daily_result` | 90 days | Deleted; only the day's aggregate matters |
| `vault`, `vault_entry` | 365 days after last sync | Deleted with its R2 blobs |
| `vault_entry` tombstones | 90 days after every member has synced past them | Row deleted |
| `submission`, `pending` | 24 hours | Row and object deleted |
| `submission`, decided | 30 days after accept or reject | Row deleted; the object is deleted at reject |
| R2 objects with no row | Swept on reconciliation | Deleted |

**Activity, not readership, keeps a class alive.** Keying expiry on the teacher's
last *read* deletes exactly the classes that are working: a teacher who creates a
class in September, has pupils submit all year and opens the results in June has
waited around 270 days, and a read-triggered 180-day sweep would cascade away
every submission before they ever saw it. A pupil's submission is proof the class
is alive. The 400-day ceiling is what gives storage limitation a real answer,
since an indefinitely extendable retention period is not a retention period; it
covers a school year with margin, and both numbers are stated on the
class-creation screen so a teacher knows before they start.

**`result` ages out on its own.** Tying pupil records solely to the class means a
long-lived class keeps a pupil's scores years after they have left. An independent
180-day cap on each row sheds them regardless.

R2 layout:

```text
vault/<vaultId>/<songId>                # user-imported scores, deduped within a vault
submission/<submissionId>.mxl           # awaiting review
```

**Deletion across D1 and R2 is not atomic**, so ordering is part of the design:
the R2 object is deleted before the row that names it. A row pointing at a missing
object is a recoverable inconsistency; an object no row names is invisible and
bills forever. A reconciliation pass lists each R2 prefix against its table and
collects the difference.

## Security

**Threat model.** The realistic adversaries are, in descending order of
likelihood: a bored player poking the API; an automated scanner hitting every
path; someone who wants their daily grade to look better; someone uploading
copyrighted or abusive material through catalogue submission; someone who obtains
a class token and adds noise to a teacher's table. There is no high-value target
here — no money, no credentials, no personal data by design — which is itself the
strongest control in the list.

**Input.** Every body is size-capped before it is read, and every field is
validated by a `core/` parser that is total and never throws. No parser here
accepts unbounded arrays; each carries an explicit element cap. `core/shareCode.ts`
already demonstrates the discipline, capping both encoded length and decompressed
bytes because the decompressor fills a fixed buffer. A worker decoding a share
code inherits both caps by importing that function.

**Authorization.** Tokens are compared by constant-time comparison over their
hashes. A wrong token returns 404 rather than 401 wherever the existence of the
object is itself information — a scanner should not be able to enumerate valid
class ids by response code.

**Rate limiting is keyed on the capability token first, and on IP only coarsely.**
A per-IP write limit breaks the flagship use case on its first real outing:
thirty pupils in one room finishing an assignment share one public IPv4 behind the
school's NAT, so a 10-per-minute rule rejects most of the class. Mobile CGNAT does
the same to a whole carrier region. In the other direction, per-IP is no
constraint at all on the adversary — anyone with a residential IPv6 allocation has
a `/64` to spend, so a per-address limit is a per-attempt limit.

| Scope | Limit |
| --- | --- |
| Per class write token | 200/hour — a real class, with headroom |
| Per class read token | 60/minute |
| Per device identifier | 10/minute for writes |
| Per IPv4 `/24` or IPv6 `/64` | A high backstop only, not a per-request control |
| Class creation | 5/minute per prefix, plus Turnstile |
| Catalogue submission | 3/hour per prefix, plus Turnstile |

Exceeding returns 429 with `Retry-After`. Bucketing IPs by prefix rather than by
address is what makes the backstop meaningful against an attacker with an address
range, and coarse enough not to punish a shared network.

**The limiter must state how it fails.** It runs in a Durable Object and shares
the same exhaustible daily allowance as the endpoints it protects, so its own
failure is a case the design has to decide rather than discover: **writes fail
closed** (a write that cannot be rate-limited is refused) and **reads fail open**
(a read that cannot be rate-limited is served). Reads are limited through a coarse
counter rather than a per-request DO round-trip, so the expensive path is spent
only where a write justifies it.

**Turnstile** on class creation and on catalogue submission. Free, unlimited
verifications, no personal data collected, and it stops the automated bulk case
without an account.

**CORS.** An explicit allowlist of origins — the production domain and the
preview wildcard — never `*` on any endpoint carrying a token. Preflight
responses are cached with `Access-Control-Max-Age` to reduce the preflight tax
described in [Topology](#topology).

**Secrets.** Worker secrets go in via `wrangler secret put` and never into `VITE_`
variables, which are inlined into a public client bundle. The client holds no
secret at all: `VITE_API_BASE` is a public URL, and every token the client holds
is one a user was given for their own object.

**Supply chain.** The worker's dependency list stays near-empty. Its `package.json`
is separate from the root, so a dependency added for the server cannot reach the
client bundle, and Renovate covers both.

**What is deliberately absent.** No admin endpoint, no way to list all classes, no
way to read another vault, no server-side eval of anything user-supplied, and no
endpoint that returns a token it did not just create.

## Privacy and law

The operator is in Germany, so GDPR applies from the first stored byte, and the
design's job is to keep the amount of regulated data at or near zero.

**What is stored by each capability.** Result collection stores a pupil-chosen
display name. Daily comparison stores a per-capability derived identifier. The
vault stores whatever the player's device holds, including class write tokens.
Catalogue submission stores a source URL and an optional note. Artist pages store
what an artist chose to publish about themselves. Nothing stores an email address
or a password.

**Artists are the easy case and pupils are the hard one.** An artist is an adult
who asked for a public profile, so consent is freely given and valid, and the
duties are ordinary — name the processing, offer removal. Everything difficult
below concerns children who did not choose to be there.

**IP addresses are processed, and saying otherwise would be false.** Cloudflare
sees the client IP on every request, Workers observability retains request
metadata by default, and the rate limiter is keyed on an IP prefix. The honest
statement is that IP addresses are processed for abuse control on the basis of
legitimate interests under Art. 6(1)(f), with platform-level log retention, and
that no raw IP is written into any table in the [data model](#data-model). The
earlier phrasing — "no IP beyond a transient window" — claimed more than the
platform allows.

**Cloudflare becomes a processor the moment phase 0 deploys.** The health poll
alone sends every visitor's IP to a new US-based processor, before any opt-in and
before any feature exists. The privacy policy therefore needs its API section
written and published *before* phase 0 goes live, naming Cloudflare, Inc., the
data-processing addendum, the transfer basis, the categories (IP and request
metadata), the purpose (delivery and abuse control) and the legal basis. This is a
phase-0 blocker, not a phase-1 one, and it is the earliest deadline in the plan.

**The display name is personal data of children, and labelling it a nickname does
not change that.** A teacher who tells thirty pupils to enter their names creates
a record of identifiable minors, and pseudonymisation is a risk-reduction measure
under Art. 32 rather than an exemption from the Regulation. The structural
mitigations still matter — the field asks for a nickname, the class-creation flow
says plainly that real names should not be used, the nickname-to-pupil mapping
stays on the teacher's device, and the field is length-capped, never indexed and
never searchable — and they reduce exposure without removing the obligation.

**Consent is the wrong legal basis here, and this needs resolving before phase 1
reaches a classroom.** Two independent problems: consent given because a teacher
instructed it is not freely given, and Art. 8 sets the digital-consent age at 16
in Germany, above most of the pupils in question. The workable structure is that
the school is controller and Plinky is processor, with the school's own basis
(public task under the relevant *Landesdatenschutzgesetz*) covering the
processing and a processor agreement covering us. That is a different product
posture from anything Plinky has today, and it is the question that actually gates
classroom use. It needs an answer from someone qualified to give one.

**A DPIA is likely required before result collection ships.** Systematic
processing of children's performance data for an educational purpose sits squarely
in Art. 35 territory. It is cheap to do early and expensive to retrofit.

**Data residency: use jurisdictions, and set them at creation.** D1 and R2 both
support an `eu` jurisdiction that guarantees regional storage, as do Durable
Objects. All three accept it only at creation time, so this is a phase-0 action
for every database and bucket, production and preview alike. An earlier draft
concluded that identifiable data had to live in a Durable Object because D1
offered only a best-effort location hint; that was true before D1 jurisdictions
existed and is no longer. The corrected rule is simpler: everything is created
`eu`, and `result` stays in D1 where it can be queried.

**Rights must reach the data subject, not only the token holder.** Deletion is a
first-class endpoint — `DELETE /v1/class/:classId` for a class,
`DELETE /v1/class/:classId/result/:submissionId` for one row, and the equivalent
for a vault — but a pupil holding no token could not exercise anything. Two
additions close that: the submitting device keeps its `submissionId` and can
delete its own row, and an operator-only maintenance route authenticated by a
Worker secret (never present in the client) can locate and delete a specific
record on a written request. The no-listing posture survives; a data subject
asking for erasure gets an answer.

**Analytics.** Since 2026-08-13 reach is measured by Cloudflare Web Analytics: no
cookies, no local storage, no device fingerprint, and no custom events. There is no
consent to gather, so there is no consent state to carry anywhere. Backend endpoints
add no analytics of their own beyond aggregate operational counters carrying no
identifier. Anything a phase wants to *count* about behaviour needs its own endpoint —
the beacon cannot answer a question about a feature.

**Compliance artefacts, and the phase each blocks.**

| Artefact | Blocks |
| --- | --- |
| Privacy policy section naming Cloudflare as processor | Phase 0 deploy |
| Controller/processor determination for classroom use | Phase 1 in real classrooms |
| Processor agreement template for schools | Phase 1 in real classrooms |
| DPIA covering result collection | Phase 1 in real classrooms |
| DPIA extension covering the vault | Phase 4 |

**The claim to preserve, stated accurately.** Plinky today collects nothing beyond a
cookie-free page-view count, and it fetches nothing from anyone but its own origin and
the analytics beacon. After phase 1 that
becomes "collects nothing unless a teacher opts in, and then a nickname and a
score". That remains an unusually strong position and the competitive argument the
ledger identifies for the individual-teacher market, and it is worth protecting in
every subsequent decision — which means never quietly widening what a capability
stores without revisiting this section.

## Failure and degradation

Every row is a behaviour the client must implement and a test must assert.

| Failure | Client behaviour |
| --- | --- |
| No `VITE_API_BASE` | No requests, no backend UI, no trace in the bundle's behaviour |
| DNS or connection failure | The offer to submit stays; a retry is offered; nothing else changes |
| Timeout (10 s) | Same as connection failure; the request aborts rather than hanging |
| HTTP 429 | A quiet "try again shortly", honouring `Retry-After` |
| HTTP 1027 (daily limit) | Treated as unavailable; no error text implying the player did wrong |
| HTTP 5xx | Treated as unavailable |
| Malformed body | Treated as unavailable; the parser returns `null` and nothing throws |
| An HTML error page instead of JSON | Same as malformed; Cloudflare serves its own 5xx pages and the parser must not assume JSON |
| A redirect | Not followed for API calls; treated as unavailable |
| `disabled` in the envelope | The capability's UI hides itself for the session |
| Health endpoint itself unreachable | Capabilities stay off; unknown means off, never on |
| The device is offline entirely | No request attempted; the offer is not shown rather than shown and failing |
| Service worker serving a cached API response | API paths are never cached by the service worker; only the app shell is |
| Vault sync interrupted mid-chunk | Nothing applied locally; the next sync resumes from `lastSeenRev` |
| Vault enrolment rate-limited | The player is told sync will begin shortly, and it retries later |
| Device clock far from real time | Merge uses the logical clock, so sync is unaffected; only displayed dates look wrong |

**The kill switch.** `GET /v1/health` returns a feature-flag envelope, and each
capability checks its flag before offering itself. Turning a capability off is a
server-side change with no redeploy, matching how `siteSettings.newsEnabled`
already works for the news banner. The stronger switch is removing
`VITE_API_BASE` from the build, which removes backend mode entirely at the next
deploy.

**The test that matters most.** A test asserting that with an unconfigured API the
client issues zero requests, and every existing screen behaves identically. This
is invariant 1 made executable, and it runs in the node project on every push.

## Operations

**Deployment.** `wrangler deploy` from a GitHub Actions workflow on push to
`main`, filtered to `worker/**`, **`core/**`**, `package-lock.json` and the
workflow file itself. The `core/` path is load-bearing: the website deploy already
triggers on `core/**`, so filtering the API deploy to `worker/**` alone would ship
a shared-code change to the browser and never to the Worker, leaving client and
server running different builds of the one module invariant 7 promises cannot
drift — invisibly, because both nominally import the same file.

Migrations apply before the Worker rolls, and every migration must be additive,
because the previous Worker version serves traffic while the new one deploys.
Dropping a column is a two-phase change across two deploys.

**Rollback.** `wrangler rollback` returns to the previous version in seconds.
A migration is not covered by that, which is the reason for the additive-only
rule.

**Monitoring.** Workers Logs for errors, a Cloudflare notification on error-rate,
and a scheduled Worker that writes a daily counter row and alerts when any
allowance crosses 50%. For Workers the 100k/day cap fails closed, so a runaway
costs a capability rather than money and 50% leaves time to act.

**R2 is the exception and needs a billing alert, not a quota alert.** It bills
overage with no spend cap, so the failure mode there is an invoice. A Cloudflare
billing notification plus the per-endpoint limiter on every R2 write path is what
stands between a bug and a bill. This is the one place the "free tier fails
closed" reasoning does not apply, and phases 2 and 4 are the phases that turn it
on.

**The retention sweep must be resumable and ordered.** A cron invocation carries
the same 10 ms CPU budget as a request and shares the 100k/day row-write
allowance, so a large sweep is chunked, bounded per run, and safe to interrupt: it
deletes R2 objects before the rows naming them, commits in small batches, and
picks up where it stopped. A half-finished sweep leaves consistent data and less
of it.

**Runbook.** Four scenarios, each with a decision and an owner action: quota
exhaustion (turn off the noisiest capability via the health flag), an abusive
submitter (delete the object, tighten the Turnstile action), a leaked class token
(delete the class; the teacher creates a new one), and a bad deploy (roll back,
then fix forward).

**Cost.** Zero at the volumes projected. The escape hatch if any allowance
pinches is the $5/month Workers Paid plan, which lifts nearly every limit in the
budget table. That is a deliberate decision to take, not a threshold to cross by
accident, which is why the alert fires at 50%.

## Testing

Six layers, each with a specific job.

**Pure logic.** Merge functions, parsers and token derivation are pure and live in
`core/`, tested without any worker at all. The merge laws — idempotence,
commutativity, associativity — are `fast-check` properties, and they are the
single highest-value test in the vault design. Idempotence earns special mention:
it is cheap to assert, it holds for every correct policy, and asserting it for
every row of the merge table would have caught the counter-summing bug during
review rather than in production. A policy without all three properties does not
ship.

The merge suite also carries scenario tests for the cases the properties cannot
express: a deletion surviving a round trip, a first sync between two populated
devices losing nothing, `resetDevice()` not resurrecting state, and
`importProgress()` winning over the vault copy.

**Worker unit tests.** `@cloudflare/vitest-pool-workers` runs handlers in workerd,
the real runtime, with D1 and R2 bindings emulated. These run from
`worker/vitest.config.ts` under `ci-worker`, not from a project in the root
config — every root project's include glob is anchored to `app/**`, `core/**` and
`dev/**`, and extending one would also enrol worker files in the coverage ratchet.

**Contract tests.** The client's parser and the worker's validator are the same
`core/` function, so a shared fixture set runs through both. A response shape the
client cannot parse fails the worker's test suite.

**Client adapter tests.** The established idiom: a hand-written `Fetcher` lambda
returning a `Response`, no MSW. Every failure row in the degradation table gets a
case.

**Whole-pipeline tests.** MSW handlers for the API host, added to
`app/mocks/handlers.ts` alongside the catalogue defaults, defaulting to unavailable
so that a test that does not opt in sees the degraded path — the same shape as the
catalogue handlers, which answer empty until a test says otherwise.

**Load and CPU.** A test that drives each handler with a worst-case body and
asserts CPU stays inside 10 ms. The vault's merge over a full push batch is the
one at risk, and it is measured rather than assumed.

## CI and deployment

A new top-level directory is invisible to most gates and caught by two, so the
wiring is explicit. What follows is the complete list of edits.

**Automatically applies, no change needed.** `ci-bytes` walks every tracked file.
`ci-reuse` requires the two SPDX lines on every worker source file. `ci-typos`,
`ci-yaml` and `ci-actionlint` cover the new workflow.

**Must be excluded or it breaks the build.** The root `tsconfig.json` has
`include: ["**/*"]` and would typecheck `worker/**` against a DOM library it does
not use. `worker` joins `exclude` beside `studio`, and the worker gets its own
`tsconfig.json` with `@cloudflare/workers-types`.

**Must be added or the gate silently does not cover the worker.**

| Change | File | Consequence if skipped |
| --- | --- | --- |
| `worker-points-down` rule | `.dependency-cruiser.cjs` | The worker could import `app/` |
| `worker` in the depcruise arguments | `package.json` `arch` script | The rule above never runs |
| `worker/vitest.config.ts`, owned by the worker | `worker/` | Worker tests never execute |
| A knip **workspace** entry, not just `project` | `knip.json` | See below |
| `worker/**` in the include list | `biome.json` | Worker code is unlinted |
| `ci-worker` wrapper | `flake.nix` | `ci:parity` fails the build |
| A `worker` job plus `needs:` entry | `.github/workflows/verify.yml` | The job does not gate merges |

**The worker owns its own vitest config.** Adding a `worker` project to the root
`vitest.config.ts` and invoking tests through a `ci-worker` wrapper that runs
`npm test` inside `worker/` are mutually exclusive, and the root project would
also silently pull worker files into the coverage ratchet. The `studio/`
precedent applies: the worker owns its config, its dependencies and its test
command, and `ci-worker` is the only thing that invokes them.

**Knip needs an entry point, not just a project glob.** Adding `worker/**` to
`project` without declaring entries makes every worker file an unused-file error
and fails the gate immediately. Either configure `worker` as a knip workspace with
its own `entry` (`src/index.ts`, `src/limiter.ts`), or follow `studio/` and leave
it out of knip entirely — an explicit decision either way, since the default
outcome of a half-configuration is a red build.

`ci:parity` is the gate that makes this list self-enforcing in one direction: a CI
job invoking anything other than a `ci-*` wrapper fails, and a `ci-*` name with no
`writeShellScriptBin` in `flake.nix` fails. It does not catch the reverse — a
directory nobody wired into a gate — which is why this table exists and why the
phase-0 checklist ends by verifying each row.

The new wrapper follows the established form:

```nix
(pkgs.writeShellScriptBin "ci-worker" ''
  set -e
  cd "$(git rev-parse --show-toplevel)"/worker
  npm ci
  npm run typecheck
  exec npm test "$@"
'')
```

`set -e` is not decoration. Without it the wrapper reports only the exit code of
the final command, so a failing worker typecheck passes CI silently — the same
trap the repository's own guidance names about checking exit codes rather than
piping output. Anchoring on `git rev-parse --show-toplevel` keeps the wrapper
correct when invoked from a subdirectory.

**Deployment workflow.** `.github/workflows/api.yml`, triggered on push to `main`
under `worker/**`, applying migrations then deploying, using the existing
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. The token currently
carries Cloudflare Pages Edit at account scope and needs Workers Scripts Edit, D1
Edit and R2 Edit added — a token change, not a new credential.

## Rollout

Five phases, numbered 0 to 4. Phase 2 delivers two capabilities. Each is independently shippable, independently
revertible, and ends with the app fully working whether or not the phase's
capability is switched on. No phase begins before its predecessor is deployed and
observed.

**Phase 0 — the pipeline.** `worker/` scaffolding, `wrangler.toml`, a `/v1/health`
endpoint returning the feature-flag envelope, every CI table row above wired, and
the deploy workflow green. Nothing in the client changes.

Two things in this phase are irreversible or externally binding, so they are
called out rather than left to the checklist. **Every D1 database and R2 bucket —
production *and* preview — is created with `--jurisdiction=eu`**, because the
jurisdiction cannot be added afterwards and fixing it later means migrating data
and swapping a binding on a live API. **The privacy policy's API section is
published before the first deploy**, because the health poll alone sends visitor
IPs to a new processor.

Exit criteria: a deployed health endpoint; a deliberately broken worker test turns
the build red; `wrangler d1 info` confirms the `eu` jurisdiction on every
database; and the privacy policy names Cloudflare.

**Phase 1 — result collection.** The `ResultSink` port, adapter, fake and MSW
handler; the class-creation and results-reading screens; the submit offer on
assignment completion.

Three prerequisites land before any network code, because each is a change to
`core/` that the endpoint depends on: a **stable teacher-minted assignment id and
class id carried through the share code** (the wire shape grows to
`{n, d?, i, a, c?}`); the **`plinky:classes` membership store**, so a pupil can
belong to several classes at once; and **element and length caps on the report
parser**, with properties asserting them.

Exit criteria: a real teacher collects real results from two devices; thirty
reports of one assignment group into one row set rather than thirty; **a pupil
holding memberships in two classes submits each assignment to the right one with
no picker**; a submitted row can be deleted by both teacher and submitter; and
turning the health flag off cleanly removes the feature. **Real classroom use
additionally waits on the controller/processor determination and the DPIA** in
[Privacy and law](#privacy-and-law); development does not.

**Phase 2 — artists.** Two capabilities that both route through maintainer review:
[catalogue submission](#capability-catalogue-submission), including a living
artist publishing their own CC-licensed work, and
[artist pages](#capability-artist-pages). Requires R2, and therefore a payment
method on file and a billing alert.

The client-only half of artist pages — a profile in the repository, folded into the
people index so `/person/:slug` gains a bio, a photo and social links — has no
backend dependency and can ship at any time, including before phase 0. Only editing
a profile without a maintainer needs the backend, and that rides the submission
queue rather than an endpoint of its own.

Exit criteria: a submission travels from `/library/import` through review to a
pull request without the submitter holding a GitHub account; fingerprinting runs
in Actions rather than in a Worker; orphaned uploads are collected within 24
hours; an artist edits their own links through a capability link and cannot touch
any other document or any field outside the whitelist; and a link to a
non-allowlisted domain queues rather than publishing.

**Phase 3 — daily comparison.** Exit criterion: a histogram renders after a daily
run, labelled as self-reported, showing the player's band and no rank; the daily
challenge is unchanged for anyone who does not submit; and a bounded `dateKey`
rejects out-of-range dates.

**Phase 4 — progress vault.** The largest phase by a wide margin, and the one to
slow down for. Order within the phase is itself a safety measure: the merge
functions, tombstones and their property tests land first, with no network code at
all, then the pairing flow, then sync. Exit criteria: two devices converge to
identical state under interleaved edits verified by an order-shuffling test; a
deletion on one device stays deleted everywhere; `resetDevice()` with the vault
enabled does not resurrect the wiped state; `importProgress()` with the vault
enabled yields the backup's state rather than a chimera; and a sync interrupted
mid-chunk leaves local storage untouched.

There is no phase 5. Ranked competition and the referee that would have supported
it are [declined](#declined-ranked-competition), so phase 4 is the end of the
plan.

## Decisions

Recorded so that a later reader sees what was weighed. Entries are appended,
never rewritten.

| Date | Decision | Reasoning |
| --- | --- | --- |
| 2026-08-09 | Cloudflare over a VPS or another edge platform | Existing account, credentials and domain; zero R2 egress; free-plan Durable Objects |
| 2026-08-09 | `api.plinky.fun` for phases 0–3 over a same-origin route | A separate origin cannot break the production site; the preflight cost is affordable at projected volume |
| 2026-08-09 | D1 for rows, R2 for bulk, KV for nothing | KV allows 1,000 writes/day, which no write path can live inside |
| 2026-08-09 | The worker imports `core/` rather than reimplementing grading | `core/` is already pure and already shared with `dev/`; a second implementation would drift |
| 2026-08-09 | Capability tokens over accounts | Accounts bring passwords, recovery, PII and a support burden, for no capability in scope |
| 2026-08-09 | The vault sync format differs from the progress-bundle format | The bundle is replace-not-merge with no per-key clock, which loses data when used for sync |
| 2026-08-09 | Per-store merge policies over last-write-wins | Last-write-wins silently discards a better score, a recorded take, or a day of practice |
| 2026-08-09 | Two trust tiers, never a proof claim | Reproducibility of a verdict is not authenticity of a stream; no server-side scheme separates a good bot from a good player |
| 2026-08-09 | Human review mandatory for submitted scores | The CC-only policy is a licensing obligation, and automated acceptance would create a UGC liability regime |
| 2026-08-09 | A vault has its own id, and devices join it by pairing | A vault keyed on its creating device is one no second device can ever reach, which makes the capability impossible rather than merely awkward |
| 2026-08-09 | Deletions are tombstones, not absences | Plinky deletes in five places today, and a merge treating absence as "not yet seen" resurrects every one of them on the next sync |
| 2026-08-09 | Domain caps are applied locally, never during merge | Capping a merged union at five destroys recordings, which are the only values in the store that cannot be re-derived |
| 2026-08-09 | The merge clock is a hybrid logical clock | Every timestamp Plinky stores is `Date.now()`, so a skewed device would win every comparison and silently revert the other's edits |
| 2026-08-09 | Uploads go through the Worker, not a presigned R2 URL | R2 presigned URLs cannot express a maximum size and are replayable until expiry, against the one product that bills rather than failing closed |
| 2026-08-09 | Score fingerprinting and validation run in GitHub Actions | The 10 ms CPU ceiling applies to cron and queue consumers too; unzipping and fingerprinting one ordinary score measures ~50 ms |
| 2026-08-09 | Rate limits key on capability tokens; IP only by prefix as a backstop | A per-IP write limit rejects most of a class behind one school NAT while constraining nobody who holds an IPv6 `/64` |
| 2026-08-09 | Every database and bucket is created `--jurisdiction=eu` in phase 0 | D1 and R2 both accept a jurisdiction only at creation; this is the one true one-way door in the plan |
| 2026-08-09 | Retention extends on any activity, with a hard ceiling, and results age independently | Extending only on a teacher's read deletes an active class mid-school-year; extending without a ceiling is not a retention policy at all |
| 2026-08-09 | The daily response returns a band, never a rank | A rank is a leaderboard, which the same capability explicitly declines to build |
| 2026-08-09 | An excluded run is disclosed to the player | Silent exclusion is a punishment applied in secret, which sits worse with invariant 4 than an honest message |
| 2026-08-09 | The privacy policy names Cloudflare before phase 0 deploys | The health poll alone sends visitor IPs to a new processor, before any feature exists |
| 2026-08-09 | The API deploy triggers on `core/**` as well as `worker/**` | Otherwise a shared-code change ships to the browser and not the server, which is exactly the drift invariant 7 forbids |
| 2026-08-09 | The worker owns its vitest config, following `studio/` | A root project and a `cd worker && npm test` wrapper are mutually exclusive, and the root project would pull worker files into the coverage ratchet |
| 2026-08-09 | **No ranked competition, and therefore no referee.** Supersedes the two-trust-tiers row above | Ranking players against each other is pressure, and the friendliness Plinky promotes is worth more than the engagement a ladder would buy. It is the same instinct invariant 4 already refuses in streaks. The technical case was weak independently — a referee could not have proven anything, and the server has no answer key to grade against — but the product reason decides it on its own |
| 2026-08-09 | The daily histogram is the whole of comparison | With no ladder to graduate to, "reported" stops being a lower tier and becomes the only tier, which simplifies the schema and the copy alike |
| 2026-08-09 | A shared assignment carries a teacher-minted id and a class id | The share code drops the local id and the receiver mints its own, so thirty pupils produce thirty ids for one assignment and a server-side results table cannot group them |
| 2026-08-09 | A device holds a set of class memberships, not one | A pupil at two schools, or taking two subjects at one school, is the ordinary case rather than the exception; binding the class to the assignment removes the picker and the mistake it invites |
| 2026-08-09 | Class write tokens sync through the vault | The token grants only "append to this class" and is already shared with a whole room; the alternative is re-joining every school on every device |
| 2026-08-09 | Living artists publish through the existing submission endpoint, verified by curation | The maintainer already curates the board, so no claiming flow or identity service is needed; attribution at review time is the whole mechanism |
| 2026-08-09 | Artist page editing proxies Sanity rather than adding a store | Keeps one content source and leaves the read path untouched; Studio logins were rejected because free-plan roles cannot confine an editor to one document |
| 2026-08-09 | The artist marketplace is deferred pending evidence, not declined | Its obligations are the substance of the feature, and publishing is the first step of selling regardless — so shipping the free half answers the question that decides it at no cost |
| 2026-08-13 | Sanity is removed from the app entirely; help content ships in the tree, the board and the news banner are gone | Nothing should load from a third party at runtime: the help text now lives in the message catalogue and its pictures in `public/help/`, so the help a reader sees matches the build they are running and works offline. This reverses the artist-page proxy above — there is no Sanity document left to patch, so that capability would need a store of its own if it is ever revived |
| 2026-08-13 | Production moves from GitHub Pages to Cloudflare Pages, by direct upload from Actions rather than Cloudflare's Git integration | One vendor for the site, the previews and (later) the API, and an apex Cloudflare already serves — which removes the proxy/TLS step that was the main objection to same-origin `/api/*` routing above. Direct upload because the build must run in the repo's nix devshell across the per-locale matrix, which Cloudflare's own builder cannot reproduce. The privacy policy's hosting section names Cloudflare in all 26 locales as of the same change |
| 2026-08-13 | Google Analytics is replaced by Cloudflare Web Analytics, and the consent banner, the consent setting and the whole analytics port go with it | The beacon uses no cookies, no local storage and no fingerprint, so there is nothing to consent to: the banner every visitor met on arrival and the Settings toggle behind it both existed only to gate GA. The cost is real and deliberate — Cloudflare Web Analytics has no custom events, so the 33 tracked events (runs, shares, imports, exports, milestones) stop being collected. A question about a specific feature now needs its own endpoint rather than a flag |
| 2026-08-13 | Artist profiles live in the repository and change through the submission queue, not through an editing endpoint | With no CMS to proxy, a live-edit path would mean building a store, a token, a field whitelist and a link allowlist to guard it. A profile edit is a submission like a piece is, which the artist decision above already chose as the mechanism — so the read path is a file that ships with the build, and nothing an artist writes is public until a person has read it |

## Open questions

Each needs an answer before the phase that depends on it starts. None blocks
phase 0.

1. **Is a payment method on file acceptable for R2?** R2 bills rather than failing
   closed, so this is a decision about accepting a small unbounded liability in
   exchange for two capabilities. Blocks phases 2 and 4.
2. **Who is controller for classroom use, and who writes the DPIA?** Consent is
   not a valid basis for teacher-instructed submissions by pupils under 16, so
   result collection in a German school needs the school as controller, Plinky as
   processor, and a processor agreement — or a different design. This needs
   someone qualified. Blocks phase 1 reaching real classrooms, not its
   development.
3. **Does the vault sync automatically or on request?** Automatic is better
   product and multiplies request volume, conflict surface and enrolment-wave
   risk. A manual "sync now" is the safer first version. Blocks phase 4's
   interface.
4. **Should a teacher be warned before a class expires?** Activity-based retention
   with a 400-day ceiling removes the urgent version of this problem, and stating
   both numbers at class creation may be sufficient. A warning needs a contact
   address, which is the first crack in the no-PII posture. Blocks nothing; decide
   before the first retention sweep runs.

## Maintaining this document

This document is accurate or it is worse than nothing, because its whole purpose
is to be the thing a future session reads instead of re-deriving the design.

**Update it in the same change that contradicts it.** A pull request that changes
an endpoint, a schema, a limit or an invariant updates the relevant section in the
same commit. This is the same rule the repository already applies to `README.md`
and `NEWS.md`, for the same reason: unwritten at the time means unwritten for
good. `CLAUDE.md` carries it as a standing convention so that it reaches a session
that never opens this file.

**One part of this document is mechanically enforced, and more should become so.**
The merge-policy table gets a gate that fails the build when a `plinky:` key
exists in the app with no policy row, in the spirit of `npm run tokens` and
`npm run messages:check`. A convention nobody can forget beats a convention
everybody is told about, so each phase should ask which of its invariants can be
turned into a check. The endpoint list against the router and the migration list
against the schema are both candidates.

**Status markers.** The header carries the overall status and each phase in
[Rollout](#rollout) carries its own. A phase moves to `shipped` with the date when
its exit criterion is met, and no earlier.

**Appending, not rewriting.** [Decisions](#decisions) is append-only. A reversed
decision gets a new row stating the reversal and why, leaving the original in
place. A reader needs to see that a path was considered and abandoned, or they
will propose it again.

**Re-verify the numbers.** The [free-tier budget](#free-tier-budget) is a snapshot
of a vendor's terms on one date. Re-check it at the start of each phase and stamp
the date. A design resting on a stale allowance fails at deploy time.

**Questions get answered in place.** An answered [open question](#open-questions)
moves to [Decisions](#decisions) with its answer and its reasoning, and is removed
from the list. A question list that only grows is a list nobody reads.

**Nothing here is user-facing.** This document describes internal design. Player-visible
changes belong in `NEWS.md` and `README.md` as they ship, in the voice `VOICE.md`
sets, and no part of this document's phrasing should reach the interface.
