// =============================================================================
// deleteClient — /api/child/delete and /api/account/delete.
// Deletion is server-side only (Admin SDK): the client never issues its own
// Firestore/Storage deletes for a child, so photos and every collection go
// together or not at all. Authorization: Bearer <Firebase ID token>.
// =============================================================================

import { auth } from "./firebase";

export interface ChildDeleteCounts {
  photos: number;
  avatarFiles: number;
  achievements: number;
  practiceLogs: number;
  reflections: number;
  coachNotes: number;
  inviteCodes: number;
  aiInsights: number;
  child: number;
}

export type DeleteReason = "unauthorized" | "forbidden" | "rate_limited" | "email_mismatch" | "delete_failed" | "network" | "unknown";

export class DeleteError extends Error {
  constructor(public reason: DeleteReason, public status: number, public retryAfterSec = 0) {
    super(reason);
    this.name = "DeleteError";
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) throw new DeleteError("unauthorized", 401);
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new DeleteError("network", 0);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number };
    const reason = (["unauthorized", "forbidden", "rate_limited", "email_mismatch", "delete_failed"].includes(data.error ?? "") ? data.error : "unknown") as DeleteReason;
    throw new DeleteError(reason, res.status, data.retryAfterSec ?? 0);
  }
  return res.json() as Promise<T>;
}

/** Remove one child and everything attached to it. Idempotent on the server. */
export function deleteChildRemote(childId: string) {
  return post<{ ok: true; alreadyGone: boolean; deleted: ChildDeleteCounts }>("/api/child/delete", { childId });
}

/** Remove the signed-in account (all children for a parent; links/notes for a teacher) and the Auth user. */
export function deleteAccountRemote(confirmEmail: string) {
  return post<{ ok: true; deleted: { children: number; childData: ChildDeleteCounts; authUser: number } }>("/api/account/delete", { confirmEmail });
}
