// The editor's own fonts, self-hosted (docs/restyle-plan/README.md, R1): Instrument Sans for the
// UI, Geist Mono for numbers, Bricolage Grotesque for the wordmark.
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/bricolage-grotesque/700.css";
import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { EditorShell } from "./editor/EditorShell";
import "./ui/theme.css";

// The lab is dev-only. `scripts/template-previews.ts` builds with VITE_LAB=1 into a scratch
// directory so it can render previews from a production build; shipped builds never set it.
const labEnabled = import.meta.env.DEV || import.meta.env.VITE_LAB === "1";
const isLab = labEnabled && window.location.pathname.startsWith("/lab");

if (isLab) {
  const LabPage = lazy(() => import("./lab/LabPage.tsx"));
  createRoot(document.getElementById("root")!).render(
    <Suspense fallback={<div className="bg-black text-white p-4">Loading Lab...</div>}>
      <LabPage />
    </Suspense>,
  );
} else {
  createRoot(document.getElementById("root")!).render(<EditorShell />);
}
