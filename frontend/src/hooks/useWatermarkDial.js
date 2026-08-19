import { useEffect } from "react";

export function useWatermarkDial({ setWatermarkAngleFromPoint, watermarkDialDragRef }) {
  useEffect(() => {
    function handlePointerMove(event) {
      if (!watermarkDialDragRef.current) {
        return;
      }
      setWatermarkAngleFromPoint(event.clientX, event.clientY);
    }

    function stopWatermarkDial() {
      watermarkDialDragRef.current = false;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopWatermarkDial);
    window.addEventListener("pointercancel", stopWatermarkDial);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopWatermarkDial);
      window.removeEventListener("pointercancel", stopWatermarkDial);
    };
  }, [setWatermarkAngleFromPoint, watermarkDialDragRef]);
}
