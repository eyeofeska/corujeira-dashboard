// Bundles every card in cards/ into dist/corujeira-dashboard.js, the single file HACS installs.
// Each card is a self-contained IIFE, so the bundle is the cards joined in order.
// Run: node scripts/build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(join(root, "cards")).filter(f => f.endsWith(".js")).sort();
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const parts = files.map(f => `// ---- ${f}\n${readFileSync(join(root, "cards", f), "utf8").trimEnd()}\n`);
const banner = `/* A Corujeira dashboard cards v${version}. Built from cards/ by scripts/build.mjs; edit the files in cards/, not this one.
   Contains: ${files.map(f => f.replace(/\.js$/, "")).join(", ")}. */
console.info("%c A CORUJEIRA %c dashboard cards v${version} ", "background:#2E8B57;color:#fff;font-weight:700", "background:#E8E2D6;color:#343A40");
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "corujeira-dashboard.js"), banner + "\n" + parts.join("\n"));
console.log(`dist/corujeira-dashboard.js: ${files.length} cards, v${version}`);
