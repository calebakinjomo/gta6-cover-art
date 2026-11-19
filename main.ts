// Vice City Cover Studio — entrypoint (Node 22, standard library only).
//
// Copies app/ and screenshots/ from this repository into the output
// directory and writes dossier.json there with the make.fun library.
// Never deletes or wipes the output directory: it only creates what it
// needs and writes files inside it, so it is safe on the grader's
// read-only filesystem outside /output. Deterministic: two runs over the
// same repository write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dest = join(outDir, name);
  if (!existsSync(src)) return;
  mkdirSync(outDir, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

copyTree("app");
copyTree("screenshots");

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`wrote ${join(outDir, "dossier.json")} (${dossier.length} bytes)`);
