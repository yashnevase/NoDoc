import { useEffect, useRef, useState } from "react";

import { clamp } from "../utils/fileHelpers";
import { Icon } from "./Icon";

function normalized(region) {
  const width = clamp(region.width, 0.01, 1);
  const height = clamp(region.height, 0.01, 1);
  return {
    ...region,
    width,
    height,
    x: clamp(region.x, 0, 1 - width),
    y: clamp(region.y, 0, 1 - height),
  };
}

export function EditableRegion({ className, region, style, title, onChange, onDelete }) {
  const [draft, setDraft] = useState(region);
  const [selected, setSelected] = useState(false);
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const draftRef = useRef(region);

  useEffect(() => {
    draftRef.current = region;
    setDraft(region);
  }, [region]);

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    window.removeEventListener("pointermove", moveRegion);
    window.removeEventListener("pointerup", finishRegion);
    window.removeEventListener("pointercancel", cancelRegion);
  }, []);

  function showDraft(next) {
    draftRef.current = next;
    if (frameRef.current) {
      return;
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      setDraft(draftRef.current);
    });
  }

  function beginRegion(event, mode) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const parent = event.currentTarget.closest(".editable-region")?.parentElement;
    if (!parent) {
      return;
    }
    setSelected(true);
    dragRef.current = {
      bounds: parent.getBoundingClientRect(),
      mode,
      original: draftRef.current,
      startX: event.clientX,
      startY: event.clientY,
    };
    window.addEventListener("pointermove", moveRegion);
    window.addEventListener("pointerup", finishRegion, { once: true });
    window.addEventListener("pointercancel", cancelRegion, { once: true });
  }

  function moveRegion(event) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const dx = (event.clientX - drag.startX) / Math.max(1, drag.bounds.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, drag.bounds.height);
    const next = drag.mode === "resize"
      ? normalized({ ...drag.original, width: drag.original.width + dx, height: drag.original.height + dy })
      : normalized({ ...drag.original, x: drag.original.x + dx, y: drag.original.y + dy });
    showDraft(next);
  }

  function finishRegion() {
    window.removeEventListener("pointermove", moveRegion);
    window.removeEventListener("pointercancel", cancelRegion);
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && JSON.stringify(draftRef.current) !== JSON.stringify(drag.original)) {
      onChange(draftRef.current);
    }
  }

  function cancelRegion() {
    window.removeEventListener("pointermove", moveRegion);
    dragRef.current = null;
    showDraft(region);
  }

  function handleKeyDown(event) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete();
      return;
    }
    const delta = event.shiftKey ? 0.01 : 0.0025;
    const offsets = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    if (!offsets[event.key]) {
      return;
    }
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    onChange(normalized({ ...draftRef.current, x: draftRef.current.x + dx, y: draftRef.current.y + dy }));
  }

  return (
    <div
      className={`${className} editable-region ${selected ? "is-selected" : ""}`}
      style={{ ...style, left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }}
      role="button"
      tabIndex="0"
      title={title}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setSelected(false)}
      onFocus={() => setSelected(true)}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => beginRegion(event, "move")}
    >
      <button type="button" className="editable-region-delete" title="Delete" aria-label="Delete region" onPointerDown={(event) => event.stopPropagation()} onClick={onDelete}>
        <Icon name="close" />
      </button>
      <span className="editable-region-resize" onPointerDown={(event) => beginRegion(event, "resize")} />
    </div>
  );
}
