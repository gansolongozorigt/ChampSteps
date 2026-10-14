// api/_lib/push.ts — pure core behind /api/push/register, /api/push/unregister
// and /api/cron/reminders.
//
// No Firebase imports: every side effect goes through `PushDeps` / `ReminderDeps`,
// so the whole flow is unit-tested with `node --test` against in-memory mocks
// (tests/push.test.mjs). api/_lib/adminPushDeps.ts wires the real Admin SDK.
//
// Data (server-written only; firestore.rules keeps both closed to clients):
//   pushTokens/{token}            uid, platform, lang, createdAt, lastSeenAt
//   system/reminderRuns/days/{YYYY-MM-DD}  one doc per calendar day (Ulaanbaatar) = idempotent cron
// Client-written (users/{uid}.reminders, allowed by the users update rule):
//   reminders: { daily: boolean, competition: boolean, updatedAt }

export const LANGS = ["mn", "en", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export const PLATFORMS = ["ios-pwa", "android", "desktop"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** FCM registration tokens are URL-safe strings; anything else is rejected before touching Firestore. */
export const TOKEN_RE = /^[A-Za-z0-9_:-]{20,4096}$/;

/** Ulaanbaatar is UTC+8 all year (no DST since 2017). */
export const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Calendar day in Ulaanbaatar for a UTC instant, as YYYY-MM-DD. */
export function ubDateKey(nowMs: number): string {
  return new Date(nowMs + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** FCM error codes that mean "this token will never work again". */
export const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// -----------------------------------------------------------------------------
// Register / unregister
// -----------------------------------------------------------------------------

export interface RegisterInput {
  token: string;
  platform: Platform;
  lang: Lang;
}

export function parseRegisterBody(body: unknown): RegisterInput | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  if (!TOKEN_RE.test(token)) return null;
  const platform = (PLATFORMS as readonly string[]).includes(String(b.platform)) ? (b.platform as Platform) : "desktop";
  const lang = (LANGS as readonly string[]).includes(String(b.lang)) ? (b.lang as Lang) : "mn";
  return { token, platform, lang };
}

export interface PushDeps {
  verifyToken(idToken: unknown): Promise<{ uid: string } | null>;
  /** Create or refresh pushTokens/{token}. createdAt is kept when the doc already exists. */
  upsertToken(token: string, data: { uid: string; platform: Platform; lang: Lang }, nowMs: number): Promise<void>;
  /** Delete pushTokens/{token} when it belongs to uid (or is already gone). Returns false when it belongs to someone else. */
  deleteToken(token: string, uid: string): Promise<boolean>;
  now(): number;
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function processRegister(deps: PushDeps, idToken: unknown, body: unknown): Promise<ApiResult> {
  const user = await deps.verifyToken(idToken);
  if (!user) return { status: 401, body: { error: "Unauthorized" } };
  const input = parseRegisterBody(body);
  if (!input) return { status: 400, body: { error: "invalid_token" } };
  await deps.upsertToken(input.token, { uid: user.uid, platform: input.platform, lang: input.lang }, deps.now());
  return { status: 200, body: { ok: true } };
}

export async function processUnregister(deps: PushDeps, idToken: unknown, body: unknown): Promise<ApiResult> {
  const user = await deps.verifyToken(idToken);
  if (!user) return { status: 401, body: { error: "Unauthorized" } };
  const token = typeof (body as { token?: unknown })?.token === "string" ? String((body as { token: string }).token) : "";
  if (!TOKEN_RE.test(token)) return { status: 400, body: { error: "invalid_token" } };
  const ok = await deps.deleteToken(token, user.uid);
  if (!ok) return { status: 403, body: { error: "not_owner" } };
  return { status: 200, body: { ok: true } };
}

// -----------------------------------------------------------------------------
// Reminder texts (no emoji; child names are user content)
// -----------------------------------------------------------------------------

export interface ReminderText {
  title: string;
  body: string;
}

const TEXTS: Record<Lang, { daily: (names: string) => string; competition: (title: string, name: string) => string; title: string }> = {
  mn: {
    title: "ChampStep",
    daily: (names) => `${names}: өнөөдрийн бэлтгэлээ тэмдэглэх үү?`,
    competition: (title, name) => `Маргааш: ${title} (${name}). Амжилт хүсье!`,
  },
  en: {
    title: "ChampStep",
    daily: (names) => `${names}: log today's practice?`,
    competition: (title, name) => `Tomorrow: ${title} (${name}). Good luck!`,
  },
  ru: {
    title: "ChampStep",
    daily: (names) => `${names}: отметить сегодняшнюю тренировку?`,
    competition: (title, name) => `Завтра: ${title} (${name}). Удачи!`,
  },
};

export function dailyText(lang: Lang, childNames: string[]): ReminderText {
  const t = TEXTS[lang] ?? TEXTS.mn;
  return { title: t.title, body: t.daily(childNames.join(", ")) };
}

export function competitionText(lang: Lang, title: string, childName: string): ReminderText {
  const t = TEXTS[lang] ?? TEXTS.mn;
  return { title: t.title, body: t.competition(title, childName) };
}

// -----------------------------------------------------------------------------
// Daily cron
// -----------------------------------------------------------------------------

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; a manual curl does the same. */
export function isCronAuthorized(header: unknown, secret: string | undefined): boolean {
  if (!secret) return false;
  return header === `Bearer ${secret}`;
}

export interface ReminderUser {
  uid: string;
  daily: boolean;
  competition: boolean;
}

export interface ChildLike {
  childId: string;
  name: string;
}

export interface TokenLike {
  token: string;
  lang: Lang;
}

export interface OutgoingMessage {
  token: string;
  title: string;
  body: string;
  /** In-app path the notification opens. */
  url: string;
  /** Collapses duplicates on the device. */
  tag: string;
}

export interface SendResult {
  token: string;
  ok: boolean;
  errorCode?: string;
}

export interface ReminderDeps {
  now(): number;
  /** Users whose reminders.daily or reminders.competition is true. */
  listReminderUsers(): Promise<ReminderUser[]>;
  childrenOf(uid: string): Promise<ChildLike[]>;
  /** childIds (subset of the input) that have at least one practiceLog on `date`. */
  childrenWithLogOn(childIds: string[], date: string): Promise<Set<string>>;
  /** Achievements whose `date` equals the given day (a future date = a planned competition). */
  achievementsOn(childIds: string[], date: string): Promise<Array<{ childId: string; title: string }>>;
  tokensOf(uid: string): Promise<TokenLike[]>;
  send(messages: OutgoingMessage[]): Promise<SendResult[]>;
  deleteTokens(tokens: string[]): Promise<void>;
  /** Atomically create system/reminderRuns/{dateKey}. false = a run already exists for that day. */
  claimRun(dateKey: string, nowMs: number): Promise<boolean>;
  finishRun(dateKey: string, summary: RunSummary): Promise<void>;
}

export interface RunSummary {
  date: string;
  users: number;
  notified: number;
  sent: number;
  failed: number;
  deletedTokens: number;
  byKind: { daily: number; competition: number };
  skippedAlreadyLogged: number;
  skippedNoTokens: number;
  skippedNoChildren: number;
  finishedAt?: number;
}

export type Decision =
  | { kind: "competition"; childName: string; title: string }
  | { kind: "daily"; childNames: string[] }
  | { kind: "none"; reason: "no-children" | "all-logged" | "disabled" };

/**
 * What (if anything) one user gets today. At most one notification: the
 * competition reminder wins because it is the more specific one.
 */
export function decide(
  user: ReminderUser,
  children: ChildLike[],
  loggedToday: Set<string>,
  tomorrowEvents: Array<{ childId: string; title: string }>
): Decision {
  if (!user.daily && !user.competition) return { kind: "none", reason: "disabled" };
  if (children.length === 0) return { kind: "none", reason: "no-children" };
  if (user.competition && tomorrowEvents.length > 0) {
    const ev = tomorrowEvents[0];
    const child = children.find((c) => c.childId === ev.childId);
    return { kind: "competition", childName: child?.name ?? "", title: ev.title };
  }
  if (user.daily) {
    const missing = children.filter((c) => !loggedToday.has(c.childId)).map((c) => c.name);
    if (missing.length > 0) return { kind: "daily", childNames: missing };
    return { kind: "none", reason: "all-logged" };
  }
  return { kind: "none", reason: "disabled" };
}

export function messagesFor(decision: Decision, tokens: TokenLike[], dateKey: string): OutgoingMessage[] {
  if (decision.kind === "none") return [];
  return tokens.map((tk) => {
    const text = decision.kind === "competition"
      ? competitionText(tk.lang, decision.title, decision.childName)
      : dailyText(tk.lang, decision.childNames);
    return {
      token: tk.token,
      title: text.title,
      body: text.body,
      url: decision.kind === "competition" ? "/" : "/today",
      tag: `reminder-${dateKey}`,
    };
  });
}

export async function runReminders(deps: ReminderDeps): Promise<{ claimed: boolean; summary: RunSummary }> {
  const now = deps.now();
  const today = ubDateKey(now);
  const tomorrow = ubDateKey(now + 24 * 60 * 60 * 1000);
  const summary: RunSummary = {
    date: today, users: 0, notified: 0, sent: 0, failed: 0, deletedTokens: 0,
    byKind: { daily: 0, competition: 0 }, skippedAlreadyLogged: 0, skippedNoTokens: 0, skippedNoChildren: 0,
  };
  const claimed = await deps.claimRun(today, now);
  if (!claimed) return { claimed: false, summary };

  const users = await deps.listReminderUsers();
  summary.users = users.length;
  const dead: string[] = [];

  for (const user of users) {
    const children = await deps.childrenOf(user.uid);
    const ids = children.map((c) => c.childId);
    const logged = user.daily && ids.length ? await deps.childrenWithLogOn(ids, today) : new Set<string>();
    const events = user.competition && ids.length ? await deps.achievementsOn(ids, tomorrow) : [];
    const decision = decide(user, children, logged, events);
    if (decision.kind === "none") {
      if (decision.reason === "all-logged") summary.skippedAlreadyLogged++;
      if (decision.reason === "no-children") summary.skippedNoChildren++;
      continue;
    }
    const tokens = await deps.tokensOf(user.uid);
    if (tokens.length === 0) { summary.skippedNoTokens++; continue; }
    const results = await deps.send(messagesFor(decision, tokens, today));
    let okAny = false;
    for (const r of results) {
      if (r.ok) { summary.sent++; okAny = true; continue; }
      summary.failed++;
      if (r.errorCode && DEAD_TOKEN_CODES.has(r.errorCode)) dead.push(r.token);
    }
    if (okAny) { summary.notified++; summary.byKind[decision.kind]++; }
  }

  if (dead.length) {
    await deps.deleteTokens(dead);
    summary.deletedTokens = dead.length;
  }
  summary.finishedAt = deps.now();
  await deps.finishRun(today, summary);
  return { claimed: true, summary };
}
