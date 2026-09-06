# AGENTS.md

Instructions for Cursor agents (and humans) working on Yaadein.

## Before any implementation task

1. Read this file.
2. Read [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries.
3. Read the **current** milestone in [ROADMAP.md](ROADMAP.md)—implement only that milestone’s in-scope items.
4. Inspect existing code and tests before changing anything.
5. State which files need modification and why (briefly).
6. Make the **smallest** change that completes the request.
7. Do **not** refactor unrelated code.
8. Do **not** implement future roadmap milestones “while you’re here.”
9. Add or update tests for the change.
10. Run the **relevant** tests.
11. Summarize what changed.
12. Mention any architectural concern discovered.

Do not optimize prematurely. Do not create abstractions merely because they might be useful someday.

## Architecture boundaries

| Do | Do not |
|----|--------|
| Keep filesystem, hashing, and moves in main/domain/infrastructure | Import `fs` / Node crypto hashing from React components |
| Keep React + Redux for UI and presentation state | Put the Cosms decision catalog in Redux as source of truth |
| Keep Azure/Cosmos/Blob SDK usage behind adapters (`CloudApiClient`, `ObjectStorageProvider`, etc.) | Call Azure SDKs from domain classification logic or renderer |
| Keep metadata APIs separate from byte transfer | Proxy large photos/videos through Azure Functions |
| Treat **Cosmos** as authoritative for **accepted** and **rejected** | Add a local SQL decision cache; write **duplicate** docs to Cosms |
| Move `ACCEPTED` into `preserve/` only after Blob `SYNCED` | Move accepted into `preserve/` before cloud upload succeeds |
| User-initiated cleanup of `rejected/` / `duplicate/` with confirmation | Delete files without retaining Cosms decisions; auto-delete on scan |
| Prefer batch hash lookups and batch decision upserts; use size to narrow duplicate candidates | One network request per scanned file by default; treat size-only matches as duplicates |
| Keep decision, `cloudStatus`, and local availability separate | Encode sync success into the decision enum |

## Product rules agents must not violate

- **Media review workflow:** Cosms lookup → known rejected → `rejected/`; known accepted → `duplicate/`; unknown → manual review. See [PRODUCT.md](PRODUCT.md).
- **Accept path:** Cosms full upsert + Blob upload to `SYNCED` → **then** move to `preserve/YYYY/MM`. On failure, leave source unmoved and allow retry.
- **Reject path:** Cosms lean upsert → move to `rejected/YYYY/MM`.
- **Duplicate path:** hash matches accepted in Cosms → move to `duplicate/YYYY/MM`; no new Cosms document.
- **Unknown:** skip on automatic scan; only move after explicit review (or known prior Cosms decision).
- **Cleanup:** user-initiated delete of local `rejected/` and/or `duplicate/` only, after confirmation; never auto-delete during scan/review; never delete `preserve/` in this flow; **retain** Cosms decisions after local file delete.
- **Hash:** SHA-256 `contentHash` is primary content identity; always store `fileSize` with it.
- **Duplicate check:** same file size → compare SHA-256 → exact duplicate only when hashes match; size alone never proves duplication.
- **No local SQL decision cache** in MVP. Do not reintroduce SQLite/`better-sqlite3`/`sql.js` as the decision store unless the user explicitly changes product scope again.
- **Capture / event date:** user override when set; else EXIF/media metadata; else the oldest usable filesystem timestamp (`mtime` / `birthtime` / `ctime` / `atime`).
- **Tags (MVP):** extract `tags.people` / `tags.places` / `tags.events` during local processing; store rich tags on Cosms for **ACCEPTED**. Rejected Cosms docs are lean. No ML face-clustering unless the milestone requires it.
- **Cosmos shape:** partition `/userId`; required separate fields `contentHash` and `fileSize`; `id` may equal `contentHash` for point reads but is not a substitute; keep `decision` and `cloudStatus` separate.
- **Cloud write policy:** `ACCEPTED` → Cosms (full) + Blob; `REJECTED` → Cosms (lean); `DUPLICATE` → local only.
- **Secrets:** never embed Cosms keys, storage account keys, database passwords, client secrets, or privileged function keys in the Electron app.
- **Online MVP:** do not build offline decision queues unless the current milestone explicitly requires them.
- **Milestone order:** do not pull scan/classify/accept ahead of auth + Functions + Blob milestones in [ROADMAP.md](ROADMAP.md).

## Preferred coding practices

- Prefer simple, readable TypeScript over cleverness.
- Small modules with focused responsibility.
- Explicit types at API and domain boundaries; avoid `any` unless justified and temporary.
- Match existing naming, file layout, and patterns once code exists.
- Comments only for non-obvious intent or constraints—not narration.
- No drive-by refactors, no unrelated file cleanup, no new docs unless asked.

## TypeScript conventions

- Strict TypeScript when the project enables it—do not weaken strictness casually.
- Prefer `PascalCase` for types/classes, `camelCase` for values/functions, `UPPER_SNAKE` for true constants/enums of status strings if that pattern is established.
- Shared decision/cloud status string unions should match PRODUCT/ARCHITECTURE names exactly (`ACCEPTED`, `SYNCED`, etc.).
- Use `pnpm` for package management when installing dependencies.

## Testing expectations

- Every milestone and bugfix should include automated tests at the appropriate layer (unit for pure logic; temp-dir integration for FS; mocked HTTP for Cosms/Blob clients).
- Prefer testing domain and infrastructure without launching the full UI when possible.
- After changes, run the relevant test command for the touched package.
- Do not claim “tested” without running tests.

## Repo layout expectations

```text
apps/desktop/     # Electron + React
apps/api/         # Azure Functions (from Milestone 5)
packages/shared/  # Only when duplication of types becomes painful
```

Do not create empty package scaffolding ahead of need.

## Out-of-scope temptations

Unless the user or current milestone explicitly requires it, do **not** add:

- Local SQL decision cache / offline decision catalog
- Perceptual hashing / near-duplicate ML
- Mobile app code
- Multi-cloud provider frameworks
- Bidirectional sync engines / CRDTs
- Permanent deletion of `preserve/` or automatic deletion during scan/review
- IaC or CI sprawl beyond what the milestone needs
- Extra markdown docs the user did not ask for

## Working style checklist (every task)

```text
[ ] Read AGENTS.md + relevant architecture/product docs
[ ] Inspect existing implementation
[ ] Scope limited to current milestone / user ask
[ ] Smallest viable change
[ ] Tests added/updated
[ ] Relevant tests run
[ ] Summary + any architectural concerns
```
