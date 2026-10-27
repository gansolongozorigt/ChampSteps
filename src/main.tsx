import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./i18n"; // side-effect: initializes i18next with MN default
import "./index.css";
import { captureInstallPrompt } from "./lib/install";

// beforeinstallprompt (Android/Chrome) fires before React mounts — keep it for the install banner.
captureInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
