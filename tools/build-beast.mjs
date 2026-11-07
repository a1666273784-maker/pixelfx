#!/usr/bin/env node
// Build the 山海 boss effect showcase into ONE self-contained HTML file: dist/beast.html.
// The page, the styles and the pixelfx effects (with only the core they use) are inlined, so it runs from
// disk with no server and no network.
//
//   node tools/build-beast.mjs        ->  dist/beast.html
//   node tools/build-beast.mjs --serve -> also serves it (http://localhost:5050)

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/fxlib.mjs";

const OUT = join(ROOT, "dist");
mkdirSync(OUT, { recursive: true });

const bundle = await build({
  entryPoints: [join(ROOT, "src", "beast", "stage.js")],
  bundle: true, format: "iife", target: "es2020", minify: true, write: false, legalComments: "none",
  charset: "utf8",
});
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(ROOT, "src", "beast", "index.html"), "utf8").replace("<script src=\"../beast/stage.js\"></script>", "");

const page = html.replace("<!--APP-->", `<script>\n${js}\n</script>`);
// the deliverable, at the repo root so it can be handed over as it is, plus a copy under dist/ to serve
const file = join(ROOT, "beast-vfx.html");
writeFileSync(file, page);
writeFileSync(join(OUT, "beast.html"), page);
console.log(`${file}  (${(page.length / 1024).toFixed(1)} KB, self-contained)`);

if (process.argv.includes("--serve")) {
  const { createServer } = await import("node:http");
  createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(page);
  }).listen(5050, "0.0.0.0", () => console.log("serving http://localhost:5050"));
}
