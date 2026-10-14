import { cleanupAllTestUsers } from "./helpers/admin";
export default async function globalTeardown() {
  const n = await cleanupAllTestUsers();
  if (n) console.log(`[e2e teardown] removed ${n} leftover qa account(s)`);
}
