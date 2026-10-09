import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodeFrame, goldenCases, goldenNodes } from "./lane-golden-cases";

// Records the lane goldens (PF02): `npx tsx tests/fixtures/record-lane-goldens.ts`. Run it only
// to record a deliberate change in Frames or the tilted marquees; the golden test exists to
// catch every other one.

// One frame per line keeps the file diffable without a line per number.
const lines: string[] = ["{"];
const groups = Object.entries(goldenCases());
groups.forEach(([group, cases], g) => {
  lines.push(`  ${JSON.stringify(group)}: [`);
  cases.forEach((c, i) => {
    lines.push(`    { "name": ${JSON.stringify(c.name)}, "duration": ${c.duration}, "frames": [`);
    c.times.forEach((t, k) => {
      const comma = k < c.times.length - 1 ? "," : "";
      lines.push(`      ${JSON.stringify(encodeFrame(t, goldenNodes(c, t)))}${comma}`);
    });
    lines.push(`    ] }${i < cases.length - 1 ? "," : ""}`);
  });
  lines.push(`  ]${g < groups.length - 1 ? "," : ""}`);
});
lines.push("}", "");

const out = fileURLToPath(new URL("./lane-goldens.json", import.meta.url));
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${out}`);
