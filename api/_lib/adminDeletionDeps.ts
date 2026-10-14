// api/_lib/adminDeletionDeps.ts — real DeletionDeps on the Firebase Admin SDK.
// Everything in api/_lib/deletion.ts is pure; this is the only place that touches
// Firestore / Storage / Auth for the delete endpoints.

import { Timestamp, type Query } from "firebase-admin/firestore";
import { adminAuth, adminBucket, adminDb, verifyIdTokenFull } from "./firebaseAdmin.js";
import { FIRESTORE_BATCH, type DeletionDeps, type RateKind, type RateWindowState } from "./deletion.js";
import { toMillis } from "./aiGuard.js";

async function deleteQueryInBatches(q: Query): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await q.limit(FIRESTORE_BATCH).get();
    if (snap.empty) return total;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < FIRESTORE_BATCH) return total;
  }
}

export const adminDeletionDeps: DeletionDeps = {
  async verifyToken(token) {
    const d = await verifyIdTokenFull(token);
    return d ? { uid: d.uid, email: d.email } : null;
  },

  async getChild(childId) {
    const snap = await adminDb.collection("children").doc(childId).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : null;
  },

  deleteWhere(col, field, value) {
    return deleteQueryInBatches(adminDb.collection(col).where(field, "==", value));
  },

  async deleteDoc(col, id) {
    const ref = adminDb.collection(col).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  },

  async recursiveDeleteDoc(col, id) {
    const ref = adminDb.collection(col).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await adminDb.recursiveDelete(ref);
    return true;
  },

  async deleteStoragePrefix(prefix) {
    const [files] = await adminBucket().getFiles({ prefix });
    let n = 0;
    for (let i = 0; i < files.length; i += 50) {
      const results = await Promise.allSettled(files.slice(i, i + 50).map((f) => f.delete()));
      for (const r of results) {
        if (r.status === "fulfilled") n += 1;
        else if ((r.reason as { code?: number })?.code === 404) continue; // already gone
        else throw r.reason;
      }
    }
    return n;
  },

  async listChildIdsForParent(uid) {
    const snap = await adminDb.collection("children").where("parentId", "==", uid).get();
    return snap.docs.map((d) => d.id);
  },

  async listChildIdsForTeacher(uid) {
    const snap = await adminDb.collection("children").where("teacherIds", "array-contains", uid).get();
    return snap.docs.map((d) => d.id);
  },

  async removeTeacherFromChild(childId, uid) {
    const ref = adminDb.collection("children").doc(childId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const ids = snap.data()?.teacherIds;
    if (!Array.isArray(ids)) return;
    await ref.update({ teacherIds: ids.filter((t) => t !== uid) });
  },

  async deleteAuthUser(uid) {
    try {
      await adminAuth.deleteUser(uid);
      return true;
    } catch (err) {
      if ((err as { code?: string })?.code === "auth/user-not-found") return false;
      throw err;
    }
  },

  // deletionUsage/{uid} { child: {windowStart, count}, account: {...} } — server-only (rules deny all).
  async rateWindow(kind: RateKind, uid, update) {
    const ref = adminDb.collection("deletionUsage").doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data()?.[kind] as { windowStart?: unknown; count?: unknown } | undefined) : undefined;
      const state: Partial<RateWindowState> | undefined = cur
        ? { windowStart: toMillis(cur.windowStart), count: typeof cur.count === "number" ? cur.count : 0 }
        : undefined;
      const next = update(state);
      if (next) {
        tx.set(ref, { [kind]: { windowStart: Timestamp.fromMillis(next.windowStart ?? Date.now()), count: next.count, updatedAt: Timestamp.now() } }, { merge: true });
      }
    });
  },
};
