/// <reference types="vite/client" />
import { createRoot } from "react-dom/client";
import { PreviewApp } from "../src/click-preview/PreviewApp";

// A single mount keeps the one guarded legacy-storage read from being replayed.
export { PreviewApp as Preview };
const root = document.getElementById("root");
if (root) createRoot(root).render(<PreviewApp />);
