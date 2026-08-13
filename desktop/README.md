# Desktop shell (Tauri)

NoDoc's desktop shell lives here. It is responsible for becoming the real
Windows `.exe` wrapper around the React UI and Python sidecar.

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

Current status: the Tauri shell is scaffolded and ready for a Rust toolchain.
The next desktop step is sidecar management: build `backend/` with PyInstaller,
launch that binary from Rust, read its `PRIVATEPDF_PORT=` startup line, and pass
the sidecar connection info to the frontend.
