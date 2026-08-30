import { useCallback, useMemo, useState } from "react";

import {
  commitRevisionState,
  createRevisionState,
  redoRevisionState,
  undoRevisionState,
} from "../utils/revisionHistory";
import { parseWorkspace } from "../utils/workspaceRecovery";

const defaultSession = Object.freeze({
  activePageIndex: 0,
  selectedPages: [],
  dirty: false,
  activeGroup: "tools",
  activeTool: "reader",
  workingPaths: [],
  revisions: [],
  revisionIndex: -1,
  revisionVersion: 0,
  exportedRevisionId: "",
  processing: false,
  pendingJobId: "",
  draftUndo: [],
  draftRedo: [],
  lastOperation: null,
});

function newSession() {
  return {
    ...defaultSession,
    ...createRevisionState(),
    selectedPages: [],
    draftUndo: [],
    draftRedo: [],
  };
}

let documentSequence = 0;

function documentId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  documentSequence += 1;
  return `nodoc-document-${Date.now()}-${documentSequence}`;
}

function sourceKey(item) {
  if (item.source === "path") {
    return `path:${item.path}`;
  }
  return `upload:${item.name}:${item.file?.size || 0}:${item.file?.lastModified || 0}`;
}

function normalizeDocument(item) {
  return {
    ...item,
    id: item.id || documentId(),
    sourceKey: item.sourceKey || sourceKey(item),
  };
}

function resolveValue(value, current) {
  return typeof value === "function" ? value(current) : value;
}

export function useDocumentWorkspace() {
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [sessions, setSessions] = useState({});

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) || documents[0] || null,
    [activeDocumentId, documents]
  );
  const activeSession = activeDocument ? sessions[activeDocument.id] || defaultSession : defaultSession;

  const addDocuments = useCallback((items, { replace = false } = {}) => {
    const incoming = Array.from(items || []).map(normalizeDocument);
    if (!incoming.length) {
      return;
    }

    const base = replace ? [] : documents;
    const existingKeys = new Set(base.map((item) => item.sourceKey));
    const unique = incoming.filter((item) => {
      if (existingKeys.has(item.sourceKey)) {
        return false;
      }
      existingKeys.add(item.sourceKey);
      return true;
    });
    const next = [...base, ...unique];
    const preferred = unique.find((item) => item.name.toLowerCase().endsWith(".pdf")) || unique[0] || next[0];
    setDocuments(next);
    setActiveDocumentId(preferred?.id || "");
    setSessions((currentSessions) => {
      const nextSessions = replace ? {} : { ...currentSessions };
      for (const item of next) {
        nextSessions[item.id] ||= newSession();
      }
      return nextSessions;
    });
  }, [documents]);

  const closeDocument = useCallback((id) => {
    const index = documents.findIndex((document) => document.id === id);
    if (index < 0) {
      return;
    }
    const next = documents.filter((document) => document.id !== id);
    setDocuments(next);
    if (id === activeDocumentId) {
      const replacement = next[Math.min(index, Math.max(0, next.length - 1))] || null;
      setActiveDocumentId(replacement?.id || "");
    }
    setSessions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, [activeDocumentId, documents]);

  const clearDocuments = useCallback(() => {
    setDocuments([]);
    setSessions({});
    setActiveDocumentId("");
  }, []);

  const restoreWorkspace = useCallback((snapshot) => {
    const recovered = parseWorkspace(snapshot);
    if (!recovered) {
      return false;
    }
    const nextDocuments = recovered.documents.map(normalizeDocument);
    const validIds = new Set(nextDocuments.map((document) => document.id));
    const nextSessions = {};
    for (const document of nextDocuments) {
      const saved = recovered.sessions[document.id] || {};
      const revisions = Array.isArray(saved.revisions) ? saved.revisions : [];
      const revisionIndex = Math.min(Math.max(-1, saved.revisionIndex ?? -1), revisions.length - 1);
      nextSessions[document.id] = {
        ...newSession(),
        ...saved,
        revisions,
        revisionIndex,
        workingPaths: revisions[revisionIndex]?.paths || saved.workingPaths || [],
        processing: false,
        pendingJobId: "",
        draftUndo: [],
        draftRedo: [],
      };
    }
    setDocuments(nextDocuments);
    setSessions(nextSessions);
    setActiveDocumentId(validIds.has(recovered.activeDocumentId) ? recovered.activeDocumentId : nextDocuments[0]?.id || "");
    return true;
  }, []);

  const updateSession = useCallback((id, update) => {
    if (!id) {
      return;
    }
    setSessions((current) => {
      const session = current[id] || newSession();
      const patch = typeof update === "function" ? update(session) : update;
      return { ...current, [id]: { ...session, ...patch } };
    });
  }, []);

  const updateActiveSession = useCallback((update) => {
    updateSession(activeDocumentId, update);
  }, [activeDocumentId, updateSession]);

  const setSelectedPages = useCallback((value) => {
    updateActiveSession((session) => ({
      selectedPages: resolveValue(value, session.selectedPages),
    }));
  }, [updateActiveSession]);

  const setActivePageIndex = useCallback((value) => {
    updateActiveSession((session) => ({
      activePageIndex: resolveValue(value, session.activePageIndex),
    }));
  }, [updateActiveSession]);

  const setDirty = useCallback((value) => {
    updateActiveSession((session) => ({ dirty: resolveValue(value, session.dirty) }));
  }, [updateActiveSession]);

  const setWorkingPaths = useCallback((value) => {
    updateActiveSession((session) => ({
      workingPaths: resolveValue(value, session.workingPaths),
    }));
  }, [updateActiveSession]);

  const commitRevision = useCallback((revision) => {
    updateActiveSession((session) => ({
      ...commitRevisionState(session, revision),
      dirty: false,
      processing: false,
      pendingJobId: "",
      draftUndo: [],
      draftRedo: [],
    }));
  }, [updateActiveSession]);

  const undoRevision = useCallback(() => {
    updateActiveSession((session) => undoRevisionState(session));
  }, [updateActiveSession]);

  const redoRevision = useCallback(() => {
    updateActiveSession((session) => redoRevisionState(session));
  }, [updateActiveSession]);

  const markExported = useCallback((revisionId) => {
    updateActiveSession({ exportedRevisionId: revisionId || "" });
  }, [updateActiveSession]);

  return {
    activeDocument,
    activeDocumentId: activeDocument?.id || "",
    activeSession,
    addDocuments,
    clearDocuments,
    closeDocument,
    commitRevision,
    documents,
    markExported,
    redoRevision,
    restoreWorkspace,
    sessions,
    setActiveDocumentId,
    setActivePageIndex,
    setDirty,
    setSelectedPages,
    setWorkingPaths,
    undoRevision,
    updateActiveSession,
    updateSession,
  };
}
