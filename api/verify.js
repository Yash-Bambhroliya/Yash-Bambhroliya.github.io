/* /api/verify · checks the HMAC on a shared fit-report link.
   The report itself never touches storage; this only answers
   "was this token really signed by yashb.me". */

const crypto = require("crypto");

const localHits = new Map();
function localLimit(key, max) {
  const day = new Date().toISOString().slice(0, 10);
  const k = key + ":" + day;
  const n = (localHits.get(k) || 0) + 1;
  localHits.set(k, n);
  if (localHits.size > 5000) localHits.clear();
  return n <= max;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.FIT_SIGN_KEY || (process.env.FIT_MOCK === "1" ? "mock-key" : null);
  if (!key) { res.status(200).json({ valid: false, reason: "unsigned deployment" }); return; }

  const ip = (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "local").toString().split(",")[0].trim();
  if (!localLimit(ip, 200)) { res.status(429).json({ error: "rate limit" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const f = body && typeof body.f === "string" ? body.f : "";
  if (!f || f.length > 16384 || f.indexOf(".") === -1) {
    res.status(400).json({ error: "bad token" });
    return;
  }

  const at = f.lastIndexOf(".");
  const b64 = f.slice(0, at);
  const sig = f.slice(at + 1);
  try {
    const payloadStr = Buffer.from(b64, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", key).update(payloadStr).digest("base64url");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    res.status(200).json({ valid: valid });
  } catch (e) {
    res.status(200).json({ valid: false });
  }
};
