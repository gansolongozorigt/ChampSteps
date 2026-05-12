// =============================================================================
// localStore — offline/demo mode persistence
// =============================================================================
const KEY_CHILD = "champstep.child.v1";
const KEY_ACH = "champstep.achievements.v1";
const KEY_USER = "champstep.offlineUser.v1";
const KEY_SUB = "champstep.subscription.v1";
function safeParse(raw, fallback) {
    if (!raw)
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
// ---------------------------------------------------------------------------
// Child
// ---------------------------------------------------------------------------
export function loadLocalChild(fallback) {
    if (typeof window === "undefined")
        return fallback;
    return safeParse(window.localStorage.getItem(KEY_CHILD), fallback);
}
export function saveLocalChild(child) {
    if (typeof window === "undefined")
        return;
    window.localStorage.setItem(KEY_CHILD, JSON.stringify(child));
}
// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
export function loadLocalAchievements(fallback) {
    if (typeof window === "undefined")
        return fallback;
    const raw = window.localStorage.getItem(KEY_ACH);
    if (raw === null)
        return fallback;
    return safeParse(raw, fallback);
}
export function saveLocalAchievements(items) {
    if (typeof window === "undefined")
        return;
    window.localStorage.setItem(KEY_ACH, JSON.stringify(items));
}
export function loadOfflineUser() {
    if (typeof window === "undefined")
        return null;
    return safeParse(window.localStorage.getItem(KEY_USER), null);
}
export function saveOfflineUser(user) {
    if (typeof window === "undefined")
        return;
    if (user === null) {
        window.localStorage.removeItem(KEY_USER);
    }
    else {
        window.localStorage.setItem(KEY_USER, JSON.stringify(user));
    }
}
export function loadLocalSubscription() {
    if (typeof window === "undefined")
        return { status: "free" };
    return safeParse(window.localStorage.getItem(KEY_SUB), { status: "free" });
}
export function saveLocalSubscription(sub) {
    if (typeof window === "undefined")
        return;
    window.localStorage.setItem(KEY_SUB, JSON.stringify(sub));
}
