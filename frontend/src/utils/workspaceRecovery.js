const persistableSessionKeys = [
  "activePageIndex",
  "selectedPages",
  "activeGroup",
  "activeTool",
  "workingPaths",
  "revisions",
  "revisionIndex",
  "revisionVersion",
  "exportedRevisionId",
];

function stringPaths(paths) {
  return Array.isArray(paths) ? paths.filter((path) => typeof path === "string" && path) : [];
}

function sanitizeRevision(revision) {
  if (!revision || typeof revision !== "object") {
    return null;
  }
  const paths = stringPaths(revision.paths);
  if (!revision.id || !paths.length) {
    return null;
  }
  return { ...revision, paths };
}

export function serializeWorkspace(documents, activeDocumentId, sessions) {
  const pathDocuments = (documents || [])
    .filter((document) => document?.source === "path" && typeof document.path === "string" && document.path)
    .map(({ id, name, path, sourceKey }) => ({ id, name, path, source: "path", sourceKey }));
  const ids = new Set(pathDocuments.map((document) => document.id));
  const savedSessions = {};

  for (const id of ids) {
    const session = sessions?.[id] || {};
    const recovered = {};
    for (const key of persistableSessionKeys) {
      if (key in session) {
        recovered[key] = session[key];
      }
    }
    recovered.selectedPages = Array.isArray(recovered.selectedPages)
      ? recovered.selectedPages.filter((page) => Number.isInteger(page) && page > 0)
      : [];
    recovered.workingPaths = stringPaths(recovered.workingPaths);
    recovered.revisions = (recovered.revisions || []).map(sanitizeRevision).filter(Boolean);
    recovered.revisionIndex = Math.min(
      Math.max(-1, Number.isInteger(recovered.revisionIndex) ? recovered.revisionIndex : -1),
      recovered.revisions.length - 1
    );
    recovered.processing = false;
    recovered.pendingJobId = "";
    savedSessions[id] = recovered;
  }

  return {
    version: 1,
    documents: pathDocuments,
    sessions: savedSessions,
    activeDocumentId: ids.has(activeDocumentId) ? activeDocumentId : pathDocuments[0]?.id || "",
  };
}

export function parseWorkspace(value) {
  if (!value || typeof value !== "object" || value.version !== 1 || !Array.isArray(value.documents)) {
    return null;
  }
  const documents = value.documents.filter((document) =>
    document && document.source === "path" && typeof document.id === "string" && typeof document.path === "string"
  );
  if (!documents.length) {
    return null;
  }
  return {
    documents,
    sessions: value.sessions && typeof value.sessions === "object" ? value.sessions : {},
    activeDocumentId: typeof value.activeDocumentId === "string" ? value.activeDocumentId : documents[0].id,
  };
}
