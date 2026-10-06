import "@fontsource-variable/inter";
import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { EditorShell } from "./editor/EditorShell";
import "./ui/theme.css";

// The lab is dev-only. `scripts/template-previews.ts` builds with VITE_LAB=1 into a scratch
// directory so it can render previews from a production build; shipped builds never set it.
const labEnabled = import.meta.env.DEV || import.meta.env.VITE_LAB === "1";
const isLabUi = labEnabled && window.location.pathname.startsWith("/lab/ui");
const isLab = labEnabled && window.location.pathname.startsWith("/lab");

if (isLabUi) {
  const UiGallery = lazy(() => import("./lab/UiGallery.tsx"));
  createRoot(document.getElementById("root")!).render(
    <Suspense fallback={<div className="bg-black text-white p-4">Loading UI Gallery...</div>}>
      <UiGallery />
    </Suspense>,
  );
} else if (isLab) {
  const LabPage = lazy(() => import("./lab/LabPage.tsx"));
  createRoot(document.getElementById("root")!).render(
    <Suspense fallback={<div className="bg-black text-white p-4">Loading Lab...</div>}>
      <LabPage />
    </Suspense>,
  );
} else {
  createRoot(document.getElementById("root")!).render(<EditorShell />);
}
