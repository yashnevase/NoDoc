import test from "node:test";
import assert from "node:assert/strict";

import {
  commitRevisionState,
  createRevisionState,
  currentRevision,
  redoRevisionState,
  revisionLabel,
  undoRevisionState,
} from "./revisionHistory.js";

const revision = (id, path) => ({ id, paths: [path], operationType: "text" });

test("committed output becomes the current working source", () => {
  const state = commitRevisionState(createRevisionState(), revision("r1", "/tmp/r1.pdf"));
  assert.equal(currentRevision(state).id, "r1");
  assert.deepEqual(state.workingPaths, ["/tmp/r1.pdf"]);
  assert.equal(revisionLabel(state), "Working revision 1");
});

test("undo returns to the original and redo restores the exact artifact", () => {
  const committed = commitRevisionState(createRevisionState(), revision("r1", "/tmp/r1.pdf"));
  const undone = undoRevisionState(committed);
  assert.equal(currentRevision(undone), null);
  assert.deepEqual(undone.workingPaths, []);
  const redone = redoRevisionState(undone);
  assert.equal(currentRevision(redone).paths[0], "/tmp/r1.pdf");
});

test("committing after undo discards only that document's redo branch", () => {
  let documentA = createRevisionState();
  let documentB = createRevisionState();
  documentA = commitRevisionState(documentA, revision("a1", "/tmp/a1.pdf"));
  documentA = commitRevisionState(documentA, revision("a2", "/tmp/a2.pdf"));
  documentB = commitRevisionState(documentB, revision("b1", "/tmp/b1.pdf"));
  documentA = undoRevisionState(documentA);
  documentA = commitRevisionState(documentA, revision("a3", "/tmp/a3.pdf"));
  assert.deepEqual(documentA.revisions.map((item) => item.id), ["a1", "a3"]);
  assert.equal(currentRevision(documentB).id, "b1");
});
