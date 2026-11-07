#!/usr/bin/env node
// Serve the built showcase: node tools/serve-beast.mjs [port]
// "/" is the showcase page; everything else falls through to dist/.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { ROOT } from "./lib/fxlib.mjs";

const port = +(process.argv[2] ?? 5173);
const DIST = join(ROOT, "dist");
const page = () => readFileSync(join(DIST, "beast.html"));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/" || url === "/index.html" || url === "/beast.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(page());
  }
  const file = join(DIST, url);
  if (!file.startsWith(DIST) || !existsSync(file)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
}).listen(port, "0.0.0.0", () => console.log(`山海 showcase on http://0.0.0.0:${port}/`));
