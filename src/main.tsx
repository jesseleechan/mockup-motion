import "@fontsource-variable/inter";
import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isLab = import.meta.env.DEV && window.location.pathname.startsWith("/lab");

if (isLab) {
  const LabPage = lazy(() => import("./lab/LabPage.tsx"));
  createRoot(document.getElementById("root")!).render(
    <Suspense fallback={<div className="bg-black text-white p-4">Loading Lab...</div>}>
      <LabPage />
    </Suspense>,
  );
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
