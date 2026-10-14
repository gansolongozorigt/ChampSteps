import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./i18n"; // side-effect: initializes i18next with MN default
import "./index.css";
import { captureInstallPrompt } from "./lib/install";
import { isNative } from "./lib/platform";

// beforeinstallprompt (Android/Chrome) fires before React mounts — keep it for the install banner.
if (!isNative) captureInstallPrompt();
// Native shell (status bar, splash, keyboard, back button): lazy so the web bundle stays plugin-free.
if (isNative) void import("./lib/native").then((m) => m.initNativeShell());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
