// src/avatar/lazy.ts — /dev/avatar entry used by main.tsx. Kept out of
// main.tsx because Vite rewrites every `import()` it sees into a preload-helper
// call at transform time, even inside a dead branch; here the import lives in a
// function nothing calls when the flag is off, so Rollup drops the module.
import { StrictMode, createElement, type ReactElement } from "react";

/** /dev/avatar: load the playground chunk and hand the element to the caller's root. */
export function mountAvatarDevPage(render: (el: ReactElement) => void): void {
  import("./dev/AvatarDevPage").then(({ default: AvatarDevPage }) => {
    render(createElement(StrictMode, null, createElement(AvatarDevPage)));
  });
}
