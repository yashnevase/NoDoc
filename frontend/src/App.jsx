import { useState } from "react";
import { checkHealth, mergePdfs } from "./api";

export default function App() {
  const [pathsText, setPathsText] = useState("");
  const [status, setStatus] = useState("");

  async function handleHealthCheck() {
    setStatus("Checking backend...");
    try {
      const result = await checkHealth();
      setStatus(`Backend OK: ${result.status}`);
    } catch (err) {
      setStatus(`Backend error: ${err.message}`);
    }
  }

  async function handleMergeDemo() {
    const paths = pathsText
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean);

    setStatus("Merging...");
    try {
      const result = await mergePdfs(paths);
      setStatus(`Done: ${result.output_path}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <main>
      <h1>PrivatePDF</h1>
      <p>Local dev screen for the backend scaffold.</p>
      <p>
        Start the backend with <code>scripts/run-backend.ps1</code>, then use
        the buttons below.
      </p>
      <textarea
        rows="8"
        cols="80"
        placeholder={"Paste one PDF path per line to test merge.\nExample:\nC:\\docs\\a.pdf\nC:\\docs\\b.pdf"}
        value={pathsText}
        onChange={(event) => setPathsText(event.target.value)}
      />
      <div>
        <button type="button" onClick={handleHealthCheck}>
          Check backend
        </button>
        <button type="button" onClick={handleMergeDemo}>
          Merge PDFs
        </button>
      </div>
      <p>{status}</p>
    </main>
  );
}
