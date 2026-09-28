// Storage security rules — run via `npm run test:rules` (emulator required).
import { test, before, after, beforeEach } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes, deleteObject } from "firebase/storage";
import { createEnv, seed, PARENT, TEACHER, OTHER, CHILD } from "./helpers.mjs";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), `achievements/${CHILD}/seed.png`), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
  });
});

const png = (n = 3) => new Uint8Array(n);
const stor = (uid) => env.authenticatedContext(uid).storage();

test("storage: parent uploads image to own child's folders", async () => {
  await assertSucceeds(uploadBytes(ref(stor(PARENT), `achievements/${CHILD}/a.png`), png(), { contentType: "image/png" }));
  await assertSucceeds(uploadBytes(ref(stor(PARENT), `avatars/${CHILD}/a.jpg`), png(), { contentType: "image/jpeg" }));
});

test("storage: non-image or oversized upload denied", async () => {
  await assertFails(uploadBytes(ref(stor(PARENT), `achievements/${CHILD}/doc.pdf`), png(), { contentType: "application/pdf" }));
  await assertFails(uploadBytes(ref(stor(PARENT), `avatars/${CHILD}/big.png`), png(2 * 1024 * 1024 + 1), { contentType: "image/png" }));
});

test("storage: teacher reads but cannot write; stranger and anon denied", async () => {
  await assertSucceeds(getBytes(ref(stor(TEACHER), `achievements/${CHILD}/seed.png`)));
  await assertFails(uploadBytes(ref(stor(TEACHER), `achievements/${CHILD}/t.png`), png(), { contentType: "image/png" }));
  await assertFails(deleteObject(ref(stor(TEACHER), `achievements/${CHILD}/seed.png`)));
  await assertFails(getBytes(ref(stor(OTHER), `achievements/${CHILD}/seed.png`)));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), `achievements/${CHILD}/seed.png`)));
  await assertFails(uploadBytes(ref(stor(OTHER), `achievements/${CHILD}/o.png`), png(), { contentType: "image/png" }));
});

test("storage: parent deletes own; paths outside known folders denied", async () => {
  await assertSucceeds(deleteObject(ref(stor(PARENT), `achievements/${CHILD}/seed.png`)));
  await assertFails(uploadBytes(ref(stor(PARENT), `misc/${CHILD}/x.png`), png(), { contentType: "image/png" }));
});
