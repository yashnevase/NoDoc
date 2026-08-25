import { useEffect, useRef } from "react";

import { pathItems } from "../utils/fileHelpers";

export function useOpenedFiles({ rememberRecentFiles, setActiveGroup, setActiveTool, setFileItems, setResult, setStatus }) {
  const rememberRecentFilesRef = useRef(rememberRecentFiles);

  useEffect(() => {
    rememberRecentFilesRef.current = rememberRecentFiles;
  }, [rememberRecentFiles]);

  useEffect(() => {
    function loadOpenedFiles() {
      const openedPaths = window.__NODOC_OPEN_FILES__ || [];
      if (!openedPaths.length) {
        return;
      }
      const nextItems = pathItems(openedPaths);
      setFileItems(nextItems);
      if (nextItems.length === 1 && nextItems[0].name.toLowerCase().endsWith(".pdf")) {
        setActiveGroup("tools");
        setActiveTool("reader");
      }
      setResult(null);
      rememberRecentFilesRef.current(nextItems.map((item) => item.name));
      setStatus(`Opened ${openedPaths.length} file${openedPaths.length === 1 ? "" : "s"} from Windows`);
    }

    loadOpenedFiles();
    window.addEventListener("nodoc-ready", loadOpenedFiles);
    return () => window.removeEventListener("nodoc-ready", loadOpenedFiles);
  }, [setActiveGroup, setActiveTool, setFileItems, setResult, setStatus]);
}
