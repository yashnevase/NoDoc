# Desktop shell (Tauri)

Responsible for:
1. On startup: launch `backend/` (built via PyInstaller into a standalone
   sidecar binary, see `build/pyinstaller/`), read the `PRIVATEPDF_PORT=`
   line it prints to stdout, generate/relay the auth token to the frontend.
2. On shutdown: terminate the sidecar process (no orphaned processes).
3. Native file dialogs (open/save) — the only filesystem access path the
   frontend gets is through these dialogs, never direct fs access.

CSP in tauri.conf.json intentionally allows `connect-src` only to
`'self'` and `127.0.0.1:*` — the frontend cannot be coaxed into calling
any remote host even if compromised via a malicious PDF's embedded content.

Rust source (`src/main.rs` with the sidecar-management logic) is the next
implementation step once Milestone 1 engine coverage is solid enough to
wire up end-to-end.
