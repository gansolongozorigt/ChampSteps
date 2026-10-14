// api/_lib/deletion.ts — pure core behind /api/child/delete and /api/account/delete.
//
// No Firebase imports: every side effect goes through `DeletionDeps`, so the
// whole flow (auth → ownership → rate limit → ordered deletion → counts) is
// unit-tested with `node --test` against an in-memory mock (tests/deletion.test.mjs).
// api/_lib/adminDeletionDeps.ts wires the real Admin SDK.
//
// Where a child's data lives (src/lib/firebase.ts, firestore.rules, storage.rules):
//   children/{childId}                      the profile itself (flat, no subcollections)
//   achievements | practiceLogs | reflections | coachNotes | goals   docs with field childId
//   inviteCodes/{code}.childId              a redeemed teacher code points at the child
//   aiInsights/{childId}                    server-written AI cache, doc id == childId
//   Storage achievements/{childId}/**  avatars/{childId}/**
//   pushTokens/{token}.uid                  web push registrations of the account (account delete only)
//   payments/{orderId}                      uid + plan + amount only — never touched
//
// Deletion order (a failed step leaves children/{childId} in place, so a retry
// repeats the whole thing — the endpoint is idempotent):
//   Storage files → child-linked collections (batched) → inviteCodes → aiInsights → children/{childId}

// Self-contained (no local imports) so `node --test` can load this file directly.
// Same rolling-window rule as aiGuard.nextRateWindow(): the window resets once it
// is older than windowMs; a denied request leaves the stored state untouched.
export interface RateWindowState {
  windowStart: number | null;
  count: number;
}

export function nextRateWindow(
  current: Partial<RateWindowState> | undefined | null,
  nowMs: number,
  limit: number,
  windowMs: number
): { windowStart: number; count: number; allowed: boolean; retryAfterSec: number } {
  const start = typeof current?.windowStart === "number" && Number.isFinite(current.windowStart) ? current.windowStart : null;
  const count = typeof current?.count === "number" && Number.isFinite(current.count) && current.count > 0 ? Math.floor(current.count) : 0;
  if (start === null || nowMs - start >= windowMs) return { windowStart: nowMs, count: 1, allowed: true, retryAfterSec: 0 };
  if (count >= limit) return { windowStart: start, count, allowed: false, retryAfterSec: Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000)) };
  return { windowStart: start, count: count + 1, allowed: true, retryAfterSec: 0 };
}

export const CHILD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const FIRESTORE_BATCH = 400;

/** Collections whose documents carry a `childId` field. */
export const CHILD_COLLECTIONS = ["achievements", "practiceLogs", "reflections", "coachNotes", "goals"] as const;
export type ChildCollection = (typeof CHILD_COLLECTIONS)[number];

export const STORAGE_PREFIXES = (childId: string) => ({
  photos: `achievements/${childId}/`,
  avatarFiles: `avatars/${childId}/`,
});

export const RATE_LIMITS = {
  child: { limit: 10, windowMs: 60 * 60 * 1000 },
  account: { limit: 3, windowMs: 60 * 60 * 1000 },
} as const;
export type RateKind = keyof typeof RATE_LIMITS;

export interface ChildDocLike {
  parentId?: unknown;
  teacherIds?: unknown;
  name?: unknown;
}

export interface DecodedTokenLike {
  uid: string;
  email?: string;
}

export interface DeletionDeps {
  verifyToken(token: string | null): Promise<DecodedTokenLike | null>;
  getChild(childId: string): Promise<ChildDocLike | null>;
  /** Delete every doc in `col` where `field == value`, in batches. Returns the number removed. */
  deleteWhere(col: string, field: string, value: string): Promise<number>;
  /** Delete one doc. Returns true when it existed. */
  deleteDoc(col: string, id: string): Promise<boolean>;
  /** Delete one doc and any subcollections under it. Returns true when it existed. */
  recursiveDeleteDoc(col: string, id: string): Promise<boolean>;
  /** Delete every Storage object under `prefix`. Returns the number removed. */
  deleteStoragePrefix(prefix: string): Promise<number>;
  listChildIdsForParent(uid: string): Promise<string[]>;
  listChildIdsForTeacher(uid: string): Promise<string[]>;
  removeTeacherFromChild(childId: string, uid: string): Promise<void>;
  /** Delete the Firebase Auth user. Returns true when it existed. */
  deleteAuthUser(uid: string): Promise<boolean>;
  /** Read-modify-write of the rate window for (kind, uid). */
  rateWindow(kind: RateKind, uid: string, update: (cur: Partial<RateWindowState> | undefined) => RateWindowState | null): Promise<void>;
  now?: () => number;
}

export interface ChildDeleteCounts {
  photos: number;
  avatarFiles: number;
  achievements: number;
  practiceLogs: number;
  reflections: number;
  coachNotes: number;
  goals: number;
  inviteCodes: number;
  aiInsights: number;
  child: number;
}

export const ZERO_COUNTS: ChildDeleteCounts = Object.freeze({
  photos: 0, avatarFiles: 0, achievements: 0, practiceLogs: 0, reflections: 0, coachNotes: 0, goals: 0, inviteCodes: 0, aiInsights: 0, child: 0,
});

export function addCounts(a: ChildDeleteCounts, b: ChildDeleteCounts): ChildDeleteCounts {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof ChildDeleteCounts)[]) out[k] += b[k];
  return out;
}

/** Owner check: only children.parentId may delete. Teachers (uid in teacherIds) are refused. */
export function authorizeChildDelete(child: ChildDocLike | null, uid: string): "ok" | "forbidden" | "gone" {
  if (!child) return "gone";
  return child.parentId === uid ? "ok" : "forbidden";
}

/** Everything that belongs to one child, in the documented order. Safe to call twice. */
export async function deleteChildData(deps: DeletionDeps, childId: string): Promise<ChildDeleteCounts> {
  const prefixes = STORAGE_PREFIXES(childId);
  const photos = await deps.deleteStoragePrefix(prefixes.photos);
  const avatarFiles = await deps.deleteStoragePrefix(prefixes.avatarFiles);
  const counts: Record<ChildCollection, number> = { achievements: 0, practiceLogs: 0, reflections: 0, coachNotes: 0, goals: 0 };
  for (const col of CHILD_COLLECTIONS) counts[col] = await deps.deleteWhere(col, "childId", childId);
  const inviteCodes = await deps.deleteWhere("inviteCodes", "childId", childId);
  const aiInsights = (await deps.deleteDoc("aiInsights", childId)) ? 1 : 0;
  const child = (await deps.recursiveDeleteDoc("children", childId)) ? 1 : 0;
  return { photos, avatarFiles, ...counts, inviteCodes, aiInsights, child };
}

export interface AccountDeleteCounts {
  children: number;
  childData: ChildDeleteCounts;
  teacherInviteCodes: number;
  teacherCoachNotes: number;
  unlinkedStudents: number;
  userDoc: number;
  authUser: number;
}

/**
 * The whole account: every child the uid owns (via deleteChildData), the
 * teacher-side footprint (codes, notes, links), users/{uid}, usage counters,
 * then the Auth user. payments/{orderId} are kept (financial records; they
 * hold uid/plan/amount only, no personal fields to redact).
 */
export async function deleteAccountData(deps: DeletionDeps, uid: string): Promise<AccountDeleteCounts> {
  let childData = { ...ZERO_COUNTS };
  const childIds = await deps.listChildIdsForParent(uid);
  for (const id of childIds) childData = addCounts(childData, await deleteChildData(deps, id));

  const teacherInviteCodes = await deps.deleteWhere("inviteCodes", "teacherId", uid);
  const teacherCoachNotes = await deps.deleteWhere("coachNotes", "teacherId", uid);
  const taught = await deps.listChildIdsForTeacher(uid);
  for (const id of taught) await deps.removeTeacherFromChild(id, uid);

  await deps.deleteDoc("aiUsage", uid);
  await deps.deleteDoc("deletionUsage", uid);
  await deps.deleteWhere("pushTokens", "uid", uid); // web push registrations (api/_lib/push.ts)
  const userDoc = (await deps.recursiveDeleteDoc("users", uid)) ? 1 : 0;
  const authUser = (await deps.deleteAuthUser(uid)) ? 1 : 0;
  return { children: childIds.length, childData, teacherInviteCodes, teacherCoachNotes, unlinkedStudents: taught.length, userDoc, authUser };
}

// -----------------------------------------------------------------------------
// Request processing (HTTP-agnostic): { status, body, headers? }
// -----------------------------------------------------------------------------

export interface ProcessResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface IncomingLike {
  /** Already-extracted bearer token (null when absent). */
  token: string | null;
  body: unknown;
}

async function checkRate(deps: DeletionDeps, kind: RateKind, uid: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = (deps.now ?? Date.now)();
  const { limit, windowMs } = RATE_LIMITS[kind];
  let decision = { allowed: true, retryAfterSec: 0 };
  try {
    await deps.rateWindow(kind, uid, (cur) => {
      const next = nextRateWindow(cur, now, limit, windowMs);
      decision = { allowed: next.allowed, retryAfterSec: next.retryAfterSec };
      return next.allowed ? { windowStart: next.windowStart, count: next.count } : null;
    });
  } catch (err) {
    console.error(`${kind} delete rate limiter error (request allowed):`, err);
    return { allowed: true, retryAfterSec: 0 };
  }
  return decision;
}

export async function processChildDelete(req: IncomingLike, deps: DeletionDeps): Promise<ProcessResult> {
  const decoded = await deps.verifyToken(req.token);
  if (!decoded) return { status: 401, body: { error: "unauthorized" } };
  const uid = decoded.uid;

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const childId = typeof body.childId === "string" ? body.childId.trim() : "";
  if (!CHILD_ID_RE.test(childId)) return { status: 400, body: { error: "childId_required" } };

  const child = await deps.getChild(childId);
  const auth = authorizeChildDelete(child, uid);
  if (auth === "forbidden") return { status: 403, body: { error: "forbidden" } };
  if (auth === "gone") return { status: 200, body: { ok: true, alreadyGone: true, deleted: { ...ZERO_COUNTS } } };

  const rate = await checkRate(deps, "child", uid);
  if (!rate.allowed) {
    return { status: 429, body: { error: "rate_limited", retryAfterSec: rate.retryAfterSec }, headers: { "Retry-After": String(rate.retryAfterSec) } };
  }

  try {
    const deleted = await deleteChildData(deps, childId);
    return { status: 200, body: { ok: true, alreadyGone: false, deleted } };
  } catch (err) {
    console.error("child delete error:", err);
    return { status: 500, body: { error: "delete_failed" } };
  }
}

export async function processAccountDelete(req: IncomingLike, deps: DeletionDeps): Promise<ProcessResult> {
  const decoded = await deps.verifyToken(req.token);
  if (!decoded) return { status: 401, body: { error: "unauthorized" } };
  const uid = decoded.uid;

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  const tokenEmail = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  if (!confirmEmail || (tokenEmail && confirmEmail !== tokenEmail)) {
    return { status: 400, body: { error: "email_mismatch" } };
  }

  const rate = await checkRate(deps, "account", uid);
  if (!rate.allowed) {
    return { status: 429, body: { error: "rate_limited", retryAfterSec: rate.retryAfterSec }, headers: { "Retry-After": String(rate.retryAfterSec) } };
  }

  try {
    const deleted = await deleteAccountData(deps, uid);
    return { status: 200, body: { ok: true, deleted } };
  } catch (err) {
    console.error("account delete error:", err);
    return { status: 500, body: { error: "delete_failed" } };
  }
}
