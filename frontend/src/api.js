// Thin client for talking to the local Python sidecar.
// port/token are provided by the Tauri host at startup via window.__PRIVATEPDF__
// (set from Rust before the frontend loads) — never hardcoded, never fetched
// from anywhere on the internet.

function sidecarBase() {
  const cfg = window.__PRIVATEPDF__;
  if (cfg?.port && cfg?.token) {
    return { base: `http://127.0.0.1:${cfg.port}`, token: cfg.token };
  }

  const port = import.meta.env.VITE_PRIVATEPDF_PORT;
  const token = import.meta.env.VITE_PRIVATEPDF_TOKEN;
  if (!port || !token) {
    throw new Error("Sidecar connection info not available yet");
  }

  return { base: `http://127.0.0.1:${port}`, token };
}

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return body;
}

export async function checkHealth() {
  const { base } = sidecarBase();
  const res = await fetch(`${base}/health`);
  return readJson(res);
}

export async function mergePdfs(inputPaths) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/organize/merge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privatepdf-token": token,
    },
    body: JSON.stringify({ input_paths: inputPaths }),
  });
  return readJson(res);
}
