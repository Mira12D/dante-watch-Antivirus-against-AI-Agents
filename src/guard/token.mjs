// The Wachschutz activation token. The cash-desk signs "<id>.<until>" with its private key; Dante verifies it here
// with the shipped public key. So Dante knows OFFLINE whether its watch is active and until when — it never has to
// phone home to check its own status. A token that does not verify, or whose id is not this Dante's, is ignored, so
// a made-up token cannot switch the nagging off.
import { verify } from "node:crypto";

export const GUARD_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAVlqQjXYexs5IyMVExqwiXvolOBq2LZDHLNlGpfpLF7I=
-----END PUBLIC KEY-----
`;

// token = "<id>.<untilMs>.<signature base64url>" → { id, until } or null
export function verifyToken(token, pub = GUARD_PUBLIC_KEY_PEM) {
  const p = String(token || "").split(".");
  if (p.length !== 3) return null;
  const msg = p[0] + "." + p[1];
  let ok = false;
  try { ok = verify(null, Buffer.from(msg), pub, Buffer.from(p[2], "base64url")); } catch { ok = false; }
  if (!ok || !/^[A-Za-z0-9_-]{16,64}$/.test(p[0]) || !/^\d{10,16}$/.test(p[1])) return null;
  return { id: p[0], until: Number(p[1]) };
}
