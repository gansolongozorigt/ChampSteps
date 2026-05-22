// =============================================================================
// Firebase client v2 — role-based auth, multi-child, invite codes
// Collection layout:
//   /users/{uid}                — багш эсвэл эцэг эх
//   /children/{childId}         — хүүхдийн профайл
//   /inviteCodes/{code}         — багшийн урилгын код
//   /achievements/{id}          — тэмцээний бүртгэл
//   /practiceLogs/{id}          — бэлтгэлийн тэмдэглэл
//   /reflections/{id}           — нууц сэтгэлзүйн тэмдэглэл
//   /coachNotes/{id}            — багшийн зөвлөгөө
// =============================================================================
import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, updateProfile, } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, deleteDoc, } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes, } from "firebase/storage";
import { compressImage } from "../utils/image";
// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let app = null;
let _db = null;
let _storage = null;
let _auth = null;
if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
    _storage = getStorage(app);
    _auth = getAuth(app);
}
export const db = _db;
export const storage = _storage;
export const auth = _auth;
function requireDb() {
    if (!_db)
        throw new Error("Firebase тохируулагдаагүй байна.");
    return _db;
}
function requireStorage() {
    if (!_storage)
        throw new Error("Firebase Storage тохируулагдаагүй байна.");
    return _storage;
}
function requireAuth() {
    if (!_auth)
        throw new Error("Firebase Auth тохируулагдаагүй байна.");
    return _auth;
}
// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------
export async function signUpWithEmail(email, password, displayName, role) {
    const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
    if (displayName)
        await updateProfile(cred.user, { displayName });
    await ensureUserDoc(cred.user, role);
    return cred.user;
}
export async function signInWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
    return cred.user;
}
export async function signInWithGoogle(role) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(requireAuth(), provider);
    await ensureUserDoc(cred.user, role ?? "parent");
    return cred.user;
}
export async function signOut() {
    await fbSignOut(requireAuth());
}
export function onAuthChange(cb) {
    if (!_auth) {
        cb(null);
        return () => { };
    }
    return onAuthStateChanged(_auth, cb);
}
// -----------------------------------------------------------------------------
// User document
// -----------------------------------------------------------------------------
export async function ensureUserDoc(user, role = "parent") {
    const db = requireDb();
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? "",
            role,
            subscriptionTier: "free",
            createdAt: serverTimestamp(),
        });
    }
}
export async function getUserDoc(uid) {
    const db = requireDb();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists())
        return null;
    return snap.data();
}
export async function getSubscriptionTier(uid) {
    const data = await getUserDoc(uid);
    return data?.subscriptionTier ?? "free";
}
export async function getSubscriptionStatus(uid) {
    return getSubscriptionTier(uid);
}
export async function activatePremium(uid, tier = "family") {
    const db = requireDb();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await updateDoc(doc(db, "users", uid), {
        subscriptionTier: tier,
        subscriptionActivatedAt: serverTimestamp(),
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
    });
}
// -----------------------------------------------------------------------------
// Children
// -----------------------------------------------------------------------------
export async function createChild(child) {
    const db = requireDb();
    const ref = doc(db, "children", child.childId);
    await setDoc(ref, {
        childId: child.childId,
        parentId: child.parentId,
        name: child.name,
        birthDate: child.birthDate ?? "",
        bio: child.bio ?? "",
        avatarUrl: child.avatarUrl ?? null,
        teacherIds: [],
        createdAt: serverTimestamp(),
    });
}
export async function updateChild(next, avatarFile) {
    const db = requireDb();
    const childRef = doc(db, "children", next.childId);
    let avatarUrl = next.avatarUrl;
    if (avatarFile) {
        const stor = requireStorage();
        const filePath = `avatars/${next.childId}/${Date.now()}_${safeName(avatarFile.name)}`;
        const storRef = ref(stor, filePath);
        const snap = await uploadBytes(storRef, avatarFile);
        avatarUrl = await getDownloadURL(snap.ref);
    }
    await updateDoc(childRef, {
        name: next.name,
        birthDate: next.birthDate,
        bio: next.bio ?? "",
        avatarUrl: avatarUrl ?? null,
        updatedAt: serverTimestamp(),
    });
    return { ...next, avatarUrl };
}
export async function getChildrenForParent(parentId) {
    const db = requireDb();
    const q = query(collection(db, "children"), where("parentId", "==", parentId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
}
export async function getChildrenForTeacher(teacherId) {
    const db = requireDb();
    const q = query(collection(db, "children"), where("teacherIds", "array-contains", teacherId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
}
export function subscribeChildrenForTeacher(teacherId, cb) {
    const db = requireDb();
    const q = query(collection(db, "children"), where("teacherIds", "array-contains", teacherId));
    return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), childId: d.id }));
        cb(list);
    });
}
// -----------------------------------------------------------------------------
// Invite codes — багш шавиа нэмэх
// -----------------------------------------------------------------------------
export async function createInviteCode(teacherId, teacherName) {
    const db = requireDb();
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await setDoc(doc(db, "inviteCodes", code), {
        code,
        teacherId,
        teacherName,
        used: false,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
    });
    return code;
}
export async function useInviteCode(code, childId) {
    const db = requireDb();
    const ref = doc(db, "inviteCodes", code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists())
        return null;
    const data = snap.data();
    if (data.used)
        throw new Error("Энэ код аль хэдийн ашиглагдсан байна.");
    if (new Date(data.expiresAt) < new Date())
        throw new Error("Кодын хугацаа дууссан байна.");
    const childRef = doc(db, "children", childId);
    const childSnap = await getDoc(childRef);
    if (!childSnap.exists())
        throw new Error("Хүүхэд олдсонгүй.");
    const childData = childSnap.data();
    const teacherIds = childData.teacherIds ?? [];
    if (!teacherIds.includes(data.teacherId)) {
        await updateDoc(childRef, { teacherIds: [...teacherIds, data.teacherId] });
    }
    await updateDoc(ref, { used: true, childId, usedAt: new Date().toISOString() });
    return { ...data, childId };
}
// -----------------------------------------------------------------------------
// Achievements
// -----------------------------------------------------------------------------
export async function createAchievement(childId, draft) {
    const db = requireDb();
    const storage = requireStorage();
    const imageURLs = await Promise.all((draft.images ?? []).map(async (rawFile) => {
        const file = await compressImage(rawFile, { maxDimension: 1600, quality: 0.8 });
        const path = `achievements/${childId}/${Date.now()}_${safeName(file.name)}`;
        const snapshot = await uploadBytes(ref(storage, path), file);
        return getDownloadURL(snapshot.ref);
    }));
    const docRef = await addDoc(collection(db, "achievements"), {
        childId,
        title: draft.title.trim(),
        date: draft.date,
        location: draft.location.trim(),
        category: draft.category,
        description: draft.description.trim(),
        awardType: draft.awardType,
        imageURLs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}
export async function updateAchievement(id, data) {
    const db = requireDb();
    await updateDoc(doc(db, "achievements", id), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}
export async function deleteAchievement(id) {
    const db = requireDb();
    await deleteDoc(doc(db, "achievements", id));
}
export function subscribeAchievements(childId, cb, onError) {
    const db = requireDb();
    const q = query(collection(db, "achievements"), where("childId", "==", childId));
    return onSnapshot(q, (snap) => {
        const items = snap.docs.map(toAchievement).sort((a, b) => (a.date < b.date ? 1 : -1));
        cb(items);
    }, (err) => {
        console.error("[champstep] achievements error:", err);
        onError?.(err);
    });
}
function toAchievement(snap) {
    const d = snap.data();
    return {
        id: snap.id,
        childId: d.childId,
        title: d.title ?? "",
        date: d.date ?? "",
        location: d.location ?? "",
        category: d.category ?? "Academic",
        description: d.description ?? "",
        awardType: d.awardType ?? "Participant",
        imageURLs: Array.isArray(d.imageURLs) ? d.imageURLs : [],
        createdAt: tsToIso(d.createdAt),
        updatedAt: tsToIso(d.updatedAt),
    };
}
// -----------------------------------------------------------------------------
// Practice logs
// -----------------------------------------------------------------------------
export async function createPracticeLog(childId, log) {
    const db = requireDb();
    const docRef = await addDoc(collection(db, "practiceLogs"), {
        childId,
        ...log,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}
export async function deletePracticeLog(id) {
    const db = requireDb();
    await deleteDoc(doc(db, "practiceLogs", id));
}
export function subscribePracticeLogs(childId, cb) {
    const db = requireDb();
    const q = query(collection(db, "practiceLogs"), where("childId", "==", childId));
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        cb(items);
    });
}
// -----------------------------------------------------------------------------
// Reflections — зөвхөн эцэг эх харна
// -----------------------------------------------------------------------------
export async function createReflection(childId, reflection) {
    const db = requireDb();
    const docRef = await addDoc(collection(db, "reflections"), {
        childId,
        ...reflection,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}
export async function deleteReflection(id) {
    const db = requireDb();
    await deleteDoc(doc(db, "reflections", id));
}
export function subscribeReflections(childId, cb) {
    const db = requireDb();
    const q = query(collection(db, "reflections"), where("childId", "==", childId));
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        cb(items);
    });
}
export async function createCoachNote(childId, teacherId, teacherName, content) {
    const db = requireDb();
    const docRef = await addDoc(collection(db, "coachNotes"), {
        childId,
        teacherId,
        teacherName,
        content,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}
export async function deleteCoachNote(id) {
    const db = requireDb();
    await deleteDoc(doc(db, "coachNotes", id));
}
export function subscribeCoachNotes(childId, cb) {
    const db = requireDb();
    const q = query(collection(db, "coachNotes"), where("childId", "==", childId));
    return onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        cb(items);
    });
}
// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function safeName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
function tsToIso(v) {
    if (v instanceof Timestamp)
        return v.toDate().toISOString();
    if (typeof v === "string")
        return v;
    return undefined;
}
function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
export async function ensureChildDoc(child) {
    const db = requireDb();
    const ref = doc(db, "children", child.childId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            childId: child.childId,
            parentId: child.parentId,
            name: child.name,
            birthDate: child.birthDate ?? "",
            bio: child.bio ?? "",
            avatarUrl: child.avatarUrl ?? null,
            teacherIds: child.teacherIds ?? [],
            createdAt: serverTimestamp(),
        });
    }
}
// -----------------------------------------------------------------------------
// Teacher — шавийг хасах (холболт тасрах)
// -----------------------------------------------------------------------------
export async function removeStudentFromTeacher(childId, teacherId) {
    const db = requireDb();
    const childRef = doc(db, "children", childId);
    const childSnap = await getDoc(childRef);
    if (!childSnap.exists())
        return;
    const teacherIds = childSnap.data().teacherIds ?? [];
    await updateDoc(childRef, {
        teacherIds: teacherIds.filter((id) => id !== teacherId),
    });
}
export async function createPromoCode(data) {
    const db = requireDb();
    await setDoc(doc(db, "promoCodes", data.code.toUpperCase()), {
        ...data,
        code: data.code.toUpperCase(),
        usedBy: [],
    });
}
export async function togglePromoCode(code, active) {
    const db = requireDb();
    await updateDoc(doc(db, "promoCodes", code.toUpperCase()), { active });
}
export async function listPromoCodes() {
    const db = requireDb();
    const snap = await getDocs(collection(db, "promoCodes"));
    return snap.docs.map((d) => ({ ...d.data() }));
}
export async function seedPromoCodes() {
    const db = requireDb();
    const codes = [
        { code: "CHAMP3", discountMonths: 3, maxUses: 100, active: true, expiresAt: new Date("2027-01-01") },
        { code: "CHAMP6", discountMonths: 6, maxUses: 50, active: true, expiresAt: new Date("2027-01-01") },
    ];
    for (const c of codes) {
        await setDoc(doc(db, "promoCodes", c.code), { ...c, usedBy: [] });
    }
}
export async function redeemPromoCode(code, userId) {
    const db = requireDb();
    const ref = doc(db, "promoCodes", code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists())
        throw new Error("not_found");
    const data = snap.data();
    if (!data.active)
        throw new Error("Код хүчингүй болсон байна");
    if (data.usedBy.includes(userId))
        throw new Error("already_used");
    if (data.usedBy.length >= data.maxUses)
        throw new Error("max_uses");
    if (new Date() > new Date(data.expiresAt))
        throw new Error("expired");
    await updateDoc(ref, { usedBy: [...data.usedBy, userId] });
    return { months: data.discountMonths };
}
