export function BusyBar({ label, progress }) {
  if (!label) {
    return null;
  }

  return (
    <div className="busy-bar" role="status" aria-live="polite">
      <span>{progress !== null ? <i style={{ width: `${progress}%` }} /> : null}</span>
      <strong>{label}</strong>
    </div>
  );
}
