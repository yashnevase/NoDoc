import test from "node:test";
import assert from "node:assert/strict";

import { parseWorkspace, serializeWorkspace } from "./workspaceRecovery.js";

test("workspace recovery persists only local path documents and committed revisions", () => {
  const snapshot = serializeWorkspace(
    [
      { id: "path", source: "path", path: "/tmp/source.pdf", name: "source.pdf", sourceKey: "path:/tmp/source.pdf" },
      { id: "upload", source: "upload", file: { name: "private.pdf" }, name: "private.pdf" },
    ],
    "path",
    {
      path: {
        activePageIndex: 2,
        selectedPages: [1, 3],
        revisionIndex: 0,
        revisions: [{ id: "r1", paths: ["/tmp/revision.pdf"] }],
        pendingJobId: "running-job",
      },
    }
  );

  assert.equal(snapshot.documents.length, 1);
  assert.equal(snapshot.documents[0].id, "path");
  assert.equal(snapshot.sessions.path.pendingJobId, "");
  assert.equal(snapshot.sessions.path.processing, false);
  assert.deepEqual(parseWorkspace(snapshot)?.sessions.path.revisions[0].paths, ["/tmp/revision.pdf"]);
});

test("invalid recovery data is ignored", () => {
  assert.equal(parseWorkspace({ version: 2, documents: [] }), null);
  assert.equal(parseWorkspace(null), null);
});
