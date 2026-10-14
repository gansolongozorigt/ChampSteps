// api/_lib/adminPushDeps.ts — real PushDeps / ReminderDeps on the Firebase Admin SDK.
// Everything in api/_lib/push.ts is pure; this is the only place the push
// endpoints and the reminder cron touch Firestore / Auth / Cloud Messaging.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { adminDb, verifyIdTokenFull } from "./firebaseAdmin.js";
import type { ChildLike, Lang, OutgoingMessage, PushDeps, ReminderDeps, ReminderUser, RunSummary, SendResult, TokenLike } from "./push.js";

const TOKENS = "pushTokens";
// system/reminderRuns/days/{YYYY-MM-DD} — one doc per Ulaanbaatar calendar day.
const RUNS = adminDb.collection("system").doc("reminderRuns").collection("days");

/** Firestore `in` accepts up to 30 values. */
function chunk<T>(arr: T[], size = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const adminPushDeps: PushDeps = {
  async verifyToken(idToken) {
    const d = await verifyIdTokenFull(idToken);
    return d ? { uid: d.uid } : null;
  },
  async upsertToken(token, data, nowMs) {
    const ref = adminDb.collection(TOKENS).doc(token);
    const at = Timestamp.fromMillis(nowMs);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.set(ref, {
        uid: data.uid,
        platform: data.platform,
        lang: data.lang,
        lastSeenAt: at,
        ...(snap.exists ? {} : { createdAt: at }),
      }, { merge: true });
    });
  },
  async deleteToken(token, uid) {
    const ref = adminDb.collection(TOKENS).doc(token);
    const snap = await ref.get();
    if (!snap.exists) return true;
    if (snap.data()?.uid !== uid) return false;
    await ref.delete();
    return true;
  },
  now: () => Date.now(),
};

export const adminReminderDeps: ReminderDeps = {
  now: () => Date.now(),

  async listReminderUsers() {
    const byUid = new Map<string, ReminderUser>();
    for (const field of ["daily", "competition"] as const) {
      const snap = await adminDb.collection("users").where(`reminders.${field}`, "==", true).get();
      for (const d of snap.docs) {
        const r = (d.data().reminders ?? {}) as { daily?: unknown; competition?: unknown };
        byUid.set(d.id, { uid: d.id, daily: r.daily === true, competition: r.competition === true });
      }
    }
    return [...byUid.values()];
  },

  async childrenOf(uid) {
    const snap = await adminDb.collection("children").where("parentId", "==", uid).get();
    return snap.docs.map((d): ChildLike => ({ childId: d.id, name: String(d.data().name ?? "") }));
  },

  async childrenWithLogOn(childIds, date) {
    const out = new Set<string>();
    for (const ids of chunk(childIds)) {
      const snap = await adminDb.collection("practiceLogs").where("childId", "in", ids).where("date", "==", date).get();
      for (const d of snap.docs) out.add(String(d.data().childId));
    }
    return out;
  },

  async achievementsOn(childIds, date) {
    const out: Array<{ childId: string; title: string }> = [];
    for (const ids of chunk(childIds)) {
      const snap = await adminDb.collection("achievements").where("childId", "in", ids).where("date", "==", date).get();
      for (const d of snap.docs) out.push({ childId: String(d.data().childId), title: String(d.data().title ?? "") });
    }
    return out;
  },

  async tokensOf(uid) {
    const snap = await adminDb.collection(TOKENS).where("uid", "==", uid).get();
    return snap.docs.map((d): TokenLike => ({ token: d.id, lang: (d.data().lang as Lang) ?? "mn" }));
  },

  async send(messages: OutgoingMessage[]): Promise<SendResult[]> {
    if (messages.length === 0) return [];
    // Data-only payload: the service worker (src/sw.ts) renders the notification itself,
    // so iOS / Android / desktop show exactly one notification and the click opens `url`.
    const res = await getMessaging().sendEach(
      messages.map((m) => ({
        token: m.token,
        data: { title: m.title, body: m.body, url: m.url, tag: m.tag },
        webpush: { headers: { Urgency: "normal", TTL: String(6 * 60 * 60) } },
      }))
    );
    return res.responses.map((r, i) => ({
      token: messages[i].token,
      ok: r.success,
      errorCode: r.error?.code,
    }));
  },

  async deleteTokens(tokens) {
    for (const ids of chunk(tokens, 400)) {
      const batch = adminDb.batch();
      for (const t of ids) batch.delete(adminDb.collection(TOKENS).doc(t));
      await batch.commit();
    }
  },

  async claimRun(dateKey, nowMs) {
    const ref = RUNS.doc(dateKey);
    try {
      await ref.create({ status: "running", startedAt: Timestamp.fromMillis(nowMs), createdAt: FieldValue.serverTimestamp() });
      return true;
    } catch (e) {
      if ((e as { code?: number }).code === 6 /* ALREADY_EXISTS */) return false;
      throw e;
    }
  },

  async finishRun(dateKey, summary: RunSummary) {
    await RUNS.doc(dateKey).set({ status: "done", ...summary, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
  },
};
