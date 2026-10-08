import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./i18n"; // side-effect: initializes i18next with MN default
import "./index.css";
import { captureInstallPrompt } from "./lib/install";
import { mountAvatarDevPage } from "./avatar/lazy";

// beforeinstallprompt (Android/Chrome) fires before React mounts — keep it for the install banner.
captureInstallPrompt();

// /dev/avatar playground — only in `vite dev` or a VITE_AVATAR_DEV=1 build.
// The condition folds to `false` in a normal production build, so this branch,
// the import below and the AvatarDevPage chunk are all dropped.
const AVATAR_DEV_ROUTE = (import.meta.env.DEV || __AVATAR_DEV__) && window.location.pathname === "/dev/avatar";

if (AVATAR_DEV_ROUTE) {
  const root = createRoot(document.getElementById("root")!);
  mountAvatarDevPage((el) => root.render(el));
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
}
