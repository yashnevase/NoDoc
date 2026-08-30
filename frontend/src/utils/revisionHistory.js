const emptyPaths = Object.freeze([]);

export function createRevisionState(overrides = {}) {
  return {
    revisions: [],
    revisionIndex: -1,
    revisionVersion: 0,
    workingPaths: emptyPaths,
    exportedRevisionId: "",
    ...overrides,
  };
}

export function currentRevision(state) {
  const index = Number.isInteger(state?.revisionIndex) ? state.revisionIndex : -1;
  return index >= 0 ? state?.revisions?.[index] || null : null;
}

export function commitRevisionState(state, revision) {
  const revisions = state?.revisions || [];
  const index = Number.isInteger(state?.revisionIndex) ? state.revisionIndex : -1;
  const nextRevisions = [...revisions.slice(0, index + 1), revision];
  return {
    ...state,
    revisions: nextRevisions,
    revisionIndex: nextRevisions.length - 1,
    revisionVersion: (state?.revisionVersion || 0) + 1,
    workingPaths: revision.paths || emptyPaths,
    exportedRevisionId: "",
  };
}

export function undoRevisionState(state) {
  if (!state || state.revisionIndex < 0) {
    return state;
  }
  const revisionIndex = state.revisionIndex - 1;
  const revision = revisionIndex >= 0 ? state.revisions[revisionIndex] : null;
  return {
    ...state,
    revisionIndex,
    revisionVersion: (state.revisionVersion || 0) + 1,
    workingPaths: revision?.paths || emptyPaths,
  };
}

export function redoRevisionState(state) {
  if (!state || state.revisionIndex >= (state.revisions?.length || 0) - 1) {
    return state;
  }
  const revisionIndex = state.revisionIndex + 1;
  const revision = state.revisions[revisionIndex];
  return {
    ...state,
    revisionIndex,
    revisionVersion: (state.revisionVersion || 0) + 1,
    workingPaths: revision?.paths || emptyPaths,
  };
}

export function revisionLabel(state) {
  if (state?.processing) {
    return "Processing";
  }
  if (state?.dirty) {
    return "Unapplied changes";
  }
  const revision = currentRevision(state);
  if (!revision) {
    return "Original";
  }
  if (state.exportedRevisionId === revision.id) {
    return `Revision ${state.revisionIndex + 1} exported`;
  }
  return `Working revision ${state.revisionIndex + 1}`;
}

export function canUndoRevision(state) {
  return Boolean(state?.dirty || state?.revisionIndex >= 0);
}

export function canRedoRevision(state) {
  return !state?.dirty && state?.revisionIndex < (state?.revisions?.length || 0) - 1;
}
