import { useEffect } from "react";

export function useMenuEvents({
  cancelCurrentWork,
  chooseOutputFolder,
  clearFiles,
  openFiles,
  setShowSettings,
  setStatus,
}) {
  useEffect(() => {
    function handleMenuOpen() {
      void openFiles();
    }

    function handleMenuClear() {
      clearFiles();
    }

    function handleMenuOutputFolder() {
      void chooseOutputFolder();
    }

    function handleMenuCancel() {
      cancelCurrentWork();
    }

    function handleMenuSettings() {
      setShowSettings(true);
    }

    function handleMenuAbout() {
      setStatus("NoDoc is a local-first desktop PDF workspace.");
      setShowSettings(true);
    }

    window.addEventListener("nodoc-open-files", handleMenuOpen);
    window.addEventListener("nodoc-choose-output-folder", handleMenuOutputFolder);
    window.addEventListener("nodoc-clear-files", handleMenuClear);
    window.addEventListener("nodoc-cancel-task", handleMenuCancel);
    window.addEventListener("nodoc-open-settings", handleMenuSettings);
    window.addEventListener("nodoc-about", handleMenuAbout);
    return () => {
      window.removeEventListener("nodoc-open-files", handleMenuOpen);
      window.removeEventListener("nodoc-choose-output-folder", handleMenuOutputFolder);
      window.removeEventListener("nodoc-clear-files", handleMenuClear);
      window.removeEventListener("nodoc-cancel-task", handleMenuCancel);
      window.removeEventListener("nodoc-open-settings", handleMenuSettings);
      window.removeEventListener("nodoc-about", handleMenuAbout);
    };
  }, [cancelCurrentWork, chooseOutputFolder, clearFiles, openFiles, setShowSettings, setStatus]);
}
