import { useEffect } from "react";

import { signatureReportPath, signatureReportUpload } from "../api";

export function useSignatureReport({
  activeTool,
  exactlyOnePdfSelected,
  hasPaths,
  mixedSources,
  pathInputs,
  previewSourceKey,
  setSignatureBusy,
  setSignatureReport,
  setStatus,
  signatureAbortRef,
  uploadedFiles,
}) {
  useEffect(() => {
    let isCurrent = true;
    signatureAbortRef.current?.abort();
    setSignatureReport(null);
    setSignatureBusy(false);

    if (activeTool !== "digital_sign" || !exactlyOnePdfSelected || mixedSources) {
      return () => {};
    }

    const controller = new AbortController();
    signatureAbortRef.current = controller;
    setSignatureBusy(true);

    async function loadSignatureReport() {
      try {
        const response = hasPaths
          ? await signatureReportPath(pathInputs, { signal: controller.signal })
          : await signatureReportUpload(uploadedFiles, { signal: controller.signal });
        if (isCurrent) {
          setSignatureReport(response);
          setStatus(
            response.signature_count
              ? response.document_signed
                ? `Found ${response.signature_count} signature${response.signature_count === 1 ? "" : "s"}`
                : `Found ${response.signature_count} signature field${response.signature_count === 1 ? "" : "s"}`
              : "No signature fields found"
          );
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        if (isCurrent) {
          setStatus(`Signature check error: ${err.message}`);
        }
      } finally {
        if (isCurrent) {
          setSignatureBusy(false);
        }
        if (signatureAbortRef.current === controller) {
          signatureAbortRef.current = null;
        }
      }
    }

    loadSignatureReport();
    return () => {
      isCurrent = false;
      signatureAbortRef.current?.abort();
    };
  }, [activeTool, exactlyOnePdfSelected, hasPaths, mixedSources, previewSourceKey]);
}
