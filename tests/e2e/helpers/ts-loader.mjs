// Node module-resolution hook: lets `api/*.ts` run under Node's native type
// stripping although it imports its siblings with a `.js` extension (the way
// Vercel's TypeScript build expects). `./_lib/x.js` → `./_lib/x.ts` when only
// the .ts file exists. Registered by api-server.mjs for the E2E suite only.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && specifier.endsWith(".js")) {
      return nextResolve(specifier.slice(0, -3) + ".ts", context);
    }
    throw err;
  }
}
