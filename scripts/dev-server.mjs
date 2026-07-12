/* dev-server.mjs · local preview with working API routes.
   Serves the static site plus /api/fit and /api/verify in mock mode
   (FIT_MOCK=1 by default, no Gemini key needed).

   usage: node scripts/dev-server.mjs   then open http://localhost:8123 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

process.env.FIT_MOCK = process.env.FIT_MOCK || "1";
const api = {
  "/api/fit": require(join(root, "api", "fit.js")),
  "/api/verify": require(join(root, "api", "verify.js"))
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};

function resShim(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status(c) { this._c = c; return this; },
    json(o) {
      res.writeHead(this._c || 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(o));
    }
  };
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;

  if (api[path]) {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      api[path]({ method: req.method, headers: req.headers, body }, resShim(res));
    });
    return;
  }

  let file = path === "/" ? "/index.html" : path;
  file = normalize(file).replace(/^([.][.][\\/])+/, "");
  try {
    let data;
    try {
      data = await readFile(join(root, file));
    } catch (e) {
      /* cleanUrls locally too: /work/mathtutor resolves to the .html file */
      data = await readFile(join(root, file + ".html"));
      file += ".html";
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});

server.listen(8123, () => {
  console.log("yashb.me dev server: http://localhost:8123 (api in mock mode)");
});
