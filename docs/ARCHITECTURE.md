# Architecture

## Shell: Tauri (Rust) + React frontend + Python sidecar

```
┌─────────────────────────────────────────────┐
│ Tauri app (Rust core)                        │
│  - spawns/kills Python sidecar                │
│  - generates per-session auth token           │
│  - passes {port, token} to frontend via IPC    │
│                                               │
│  ┌───────────────┐        ┌─────────────────┐│
│  │ React frontend │  HTTP  │ Python sidecar   ││
│  │ (WebView)      │◄──────►│ FastAPI, bound   ││
│  │                │loopback│ to 127.0.0.1     ││
│  └───────────────┘  only   └────────┬────────┘│
└──────────────────────────────────────┼─────────┘
                                        │
                                 ┌──────▼──────┐
                                 │  engines/   │
                                 │  pdf, ocr,  │
                                 │  office, …  │
                                 └─────────────┘
```

Why this shape: the Rust core is the only thing with OS-level privileges (spawning processes, filesystem dialogs); it terminates the sidecar on app exit so no orphan process lingers. The frontend never gets raw filesystem or subprocess access — it only ever talks to the local API, which validates every request (`backend/app/validation`).

## Backend layering

- `backend/app/api/` — FastAPI routers, one per feature domain (organize, convert, ocr, security, metadata…)
- `backend/app/services/` — orchestration: turns an API request into calls against `engines/`, manages job state/progress
- `backend/app/jobs/` — background job runner (thread/process pool) so large batch operations don't block the API
- `engines/` — pure processing logic, **no FastAPI or web imports allowed here**. This is the reusable core that could later back a CLI or an Android port.

## File safety default

`original.pdf` → processed into `<same-folder>/processed/original_<operation>.pdf` (or a user-chosen output folder). Originals are opened read-only wherever the underlying library allows it.
