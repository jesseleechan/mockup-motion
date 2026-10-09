import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { desktopFramesDocs } from "./desktop-frames-template-cases";

// Records the Desktop Frames template golden (PF03):
// `npx tsx tests/fixtures/record-desktop-frames-template.ts`. Run it only to record a
// deliberate change to Desktop Frames; the golden test exists to catch every other one.
const out = fileURLToPath(new URL("./desktop-frames-template.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(desktopFramesDocs(), null, 2)}\n`);
console.log(`Wrote ${out}`);
