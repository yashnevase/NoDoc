export function StatusBar({ status }) {
  return (
    <footer className="statusbar">
      <p>{status}</p>
      <span>All work stays on this device</span>
    </footer>
  );
}
