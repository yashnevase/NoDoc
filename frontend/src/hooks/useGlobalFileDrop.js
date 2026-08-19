import { useEffect } from "react";

import { transferHasFiles, transferHasInternalPageDrag } from "../utils/fileHelpers";

export function useGlobalFileDrop({
  dragDepthRef,
  internalDragRef,
  setDropOverlayActive,
  setIsDragging,
  updateFiles,
}) {
  useEffect(() => {
    function isInternalDrag(event) {
      return internalDragRef.current || transferHasInternalPageDrag(event.dataTransfer);
    }

    function handleWindowDragEnter(event) {
      if (isInternalDrag(event)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current += 1;
      setDropOverlayActive(true);
    }

    function handleWindowDragOver(event) {
      if (isInternalDrag(event)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      setDropOverlayActive(true);
    }

    function handleWindowDragLeave(event) {
      if (isInternalDrag(event)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDropOverlayActive(false);
      }
    }

    function handleWindowDrop(event) {
      if (isInternalDrag(event)) {
        event.preventDefault();
        internalDragRef.current = false;
        dragDepthRef.current = 0;
        setDropOverlayActive(false);
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setDropOverlayActive(false);
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        updateFiles(event.dataTransfer.files);
      }
    }

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [dragDepthRef, internalDragRef, setDropOverlayActive, setIsDragging, updateFiles]);
}
