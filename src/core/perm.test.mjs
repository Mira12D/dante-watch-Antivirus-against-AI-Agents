import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirOwned, writeOwned, isOwnerOnly } from "./perm.mjs";

test("eine Datei nur für den Besitzer wird als solche erkannt, eine offene nicht", { skip: process.platform === "win32" }, () => {
  const d = mkdtempSync(join(tmpdir(), "dante-perm-")), f = join(d, "a");
  try {
    writeOwned(f, "x"); assert.equal(isOwnerOnly(f), true);
    chmodSync(f, 0o644); assert.equal(isOwnerOnly(f), false);
    const sub = join(d, "sub"); mkdirOwned(sub); assert.equal(isOwnerOnly(sub), true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test("was nicht lesbar ist, ist unbekannt (null), nicht wahr", () => assert.equal(isOwnerOnly(join(tmpdir(), "gibt-es-nicht-" + Date.now())), process.platform === "win32" ? null : null));
