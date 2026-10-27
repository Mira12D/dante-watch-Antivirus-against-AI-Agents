import test from "node:test";
import assert from "node:assert/strict";
import { validHost, configureTarget, probe, targetLabel } from "./sh.mjs";

test("ein Ziel ist ein Name, nie eine ssh-Option", () => {
  for (const ok of ["host", "root@host", "root@1.2.3.4", "my-host_1.example.com", "root@[::1]", "u@fe80::1%en0"]) assert.equal(validHost(ok), true, ok);
  for (const bad of ["-oProxyCommand=touch x", "-v", "", "a b", "$(touch x)", ";touch x", "`id`", "host\nx", "a|b", "a&b", "x".repeat(300)]) assert.equal(validHost(bad), false, bad);
});

test("ein ungültiges Ziel gibt 'kein Kanal', nie einen Befehl", () => {
  configureTarget({ host: "-oProxyCommand=touch /tmp/PWNED_BY_TEST" });
  const p = probe();
  assert.equal(p.reached, false);
  configureTarget(null);
  assert.equal(targetLabel(), "localhost");
});

import { sshReason } from "./sh.mjs";
test("ssh-Fehler werden erkannt, auch wenn die erste Zeile nur ein @-Banner ist", () => {
  const changed = "@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\nIT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!\nHost key verification failed.";
  assert.equal(sshReason(changed).code, "hostkey_changed"); assert.match(sshReason(changed).line, /WARNING: REMOTE HOST/);
  assert.equal(sshReason("Host key verification failed.").code, "hostkey_unknown");
  assert.equal(sshReason("root@h: Permission denied (publickey).").code, "denied");
  assert.equal(sshReason("ssh: connect to host h port 22: Connection timed out").code, "timeout");
  assert.equal(sshReason("ssh: connect to host h port 22: Connection refused").code, "refused");
  assert.equal(sshReason("ssh: Could not resolve hostname x: Name or service not known").code, "dns");
  assert.equal(sshReason("etwas ganz anderes").code, "other"); assert.equal(sshReason("").code, "other");
});
