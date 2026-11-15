// Writes the GitHub Release title and notes for one version from
// CHANGELOG.md ("## [X.Y.Z] - date" sections).
// Usage: node scripts/release-notes.mjs 2.14.0 [outDir]
// The Signal K App Store builds its Changelog tab from GitHub Releases; a
// tag without a Release shows up there as its truncated commit subject.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ver = process.argv[2];
const outDir = process.argv[3] || ".";
if (!ver) { console.error("usage: release-notes.mjs X.Y.Z [outDir]"); process.exit(2); }
const parts = readFileSync("CHANGELOG.md", "utf8").split(/^## /m);
const sec = parts.find((p) => p.startsWith(`[${ver}]`));
if (!sec) { console.error(`no CHANGELOG section for ${ver}`); process.exit(1); }
const nl = sec.indexOf("\n");
writeFileSync(join(outDir, "title.txt"), `v${ver}`);
writeFileSync(join(outDir, "notes.md"), sec.slice(nl + 1).trim() + "\n");
