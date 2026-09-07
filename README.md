# Yaadein

Clear digital clutter and preserve the memories that matter.

## Documentation

| Doc | Purpose |
|-----|---------|
| [PRODUCT.md](PRODUCT.md) | Purpose, workflows, MVP scope |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, Cosms/Blob, Entra user access |
| [ROADMAP.md](ROADMAP.md) | Milestones |
| [AGENTS.md](AGENTS.md) | Agent coding rules |

## Locked decisions (summary)

- **Cosmos** is the decision store — **no local SQL decision cache**
- **Solo MVP:** desktop uses **Entra user token + Azure RBAC** for Cosms/Blob — **no Functions**, **no account keys in the app**
- **Accept:** Cosms + Blob `SYNCED` → **then** `preserve/`
- **Reject:** Cosms lean → `rejected/`
- **Duplicate:** local only (accepted hash already in Cosms)
- Cosms fields: separate **`contentHash`** and **`fileSize`**; partition `/userId`
- Classify/accept/reject require **sign-in + network**

## Media review workflow

```mermaid
flowchart TD
  selectFile[Select photo or video] --> genHash[Generate hash]
  genHash --> cosmosLookup[Batch lookup Cosmos]
  cosmosLookup --> knownHash{Known hash?}
  knownHash -->|Previously rejected| moveRejected[Move to rejected]
  knownHash -->|Previously accepted| moveDuplicate[Move to duplicate]
  knownHash -->|Unknown| manualReview[Manual review]
  manualReview -->|Accept| cloudAccept[Cosmos full + Blob SYNCED]
  manualReview -->|Reject| cosmosReject[Cosmos lean REJECTED]
  cloudAccept --> movePreserve[Then move to preserve]
  cosmosReject --> moveRejected
```

Implementation follows [ROADMAP.md](ROADMAP.md). **MVP milestones M1–M12 complete.** Next: **product UX M13–M18** (packaging, home shell, Tinder review, rejected/duplicate libraries, cherish + tags). Set `apps/desktop/.env` from `.env.example` (Entra IDs + Cosms + Blob endpoints).

## Development

```bash
pnpm install
pnpm dev          # run Electron app (loads apps/desktop/.env at runtime)
pnpm test
pnpm lint
```

Desktop app: `apps/desktop`. Copy `apps/desktop/.env.example` → `apps/desktop/.env` and fill Entra IDs + Cosms/Blob endpoints (public client config only — never account keys).

## Create Mac / Windows executables

Public Entra/Cosmos/Blob values from `apps/desktop/.env` are **embedded at build time**. The installed app needs no manual `.env` copy.

```bash
# once: ensure apps/desktop/.env is filled (required keys must be non-empty)
pnpm dist:mac    # → apps/desktop/release/Yaadein-Mac-*.dmg and *.zip (arm64 + x64)
pnpm dist:win    # → apps/desktop/release/Yaadein-Windows-*-x64.zip
pnpm dist        # mac + win targets
```

Also available: `pnpm --filter @yaadein/desktop dist:dir` (unpacked app only, faster smoke).

Builds are unsigned local packages (no notarization / auto-update). Do not embed Cosms or storage **account keys**.
