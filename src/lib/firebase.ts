// =============================================================================
// Firebase client v2 — role-based auth, multi-child, invite codes
// Collection layout:
//   /users/{uid}                — багш эсвэл эцэг эх
//   /children/{childId}         — хүүхдийн профайл
//   /inviteCodes/{code}         — багшийн урилгын код
//   /achievements/{id}          — тэмцээний бүртгэл
//   /practiceLogs/{id}          — бэлтгэлийн тэмдэглэл
//   /reflections/{id}           — нууц сэтгэлзүйн тэмдэглэл
// =============================================================================

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  deleteDoc,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";

import type {
  Achievement,
  AchievementDraft,
  Child,
  InviteCode,
  PracticeLog,
  Reflection,
  SubscriptionTier,
  UserRole,
} from "../types";
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

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  _db = getFirestore(app);
  _storage = getStorage(app);
  _auth = getAuth(app);
}

export const db = _db;
export const storage = _storage;
export const auth = _auth;

function requireDb(): Firestore {
  if (!_db) throw new Error("Firebase тохируулагдаагүй байна.");
  return _db;
}
function requireStorage(): FirebaseStorage {
  if (!_storage) throw new Error("Firebase Storage тохируулагдаагүй байна.");
  return _storage;
}
function requireAuth(): Auth {
  if (!_auth) throw new Error("Firebase Auth тохируулагдаагүй байна.");
  return _auth;
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  role: UserRole
) {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user, role);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  return cred.user;
}

export async function signInWithGoogle(role?: UserRole) {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(requireAuth(), provider);
  await ensureUserDoc(cred.user, role ?? "parent");
  return cred.user;
}

export async function signOut() {
  await fbSignOut(requireAuth());
}

export function onAuthChange(cb: (user: FirebaseUser | null) => void) {
  if (!_auth) { cb(null); return () => {}; }
  return onAuthStateChanged(_auth, cb);
}

// -----------------------------------------------------------------------------
// User document
// -----------------------------------------------------------------------------

export async function ensureUserDoc(user: FirebaseUser, role: UserRole = "parent") {
  const db = requireDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      role,
      subscriptionTier: "free" as SubscriptionTier,
      createdAt: serverTimestamp(),
    });
  }
}

export async function getUserDoc(uid: string) {
  const db = requireDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function getSubscriptionTier(uid: string): Promise<SubscriptionTier> {
  const data = await getUserDoc(uid);
  return (data?.subscriptionTier as SubscriptionTier) ?? "free";
}

export async function getSubscriptionStatus(uid: string): Promise<SubscriptionTier> {
  return getSubscriptionTier(uid);
}

export async function activatePremium(uid: string, tier: SubscriptionTier = "family") {
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

export async function createChild(child: Omit<Child, "teacherIds" | "createdAt">) {
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

export async function updateChild(next: Child, avatarFile?: File) {
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

export async function getChildrenForParent(parentId: string): Promise<Child[]> {
  const db = requireDb();
  const q = query(collection(db, "children"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Child);
}

export async function getChildrenForTeacher(teacherId: string): Promise<Child[]> {
  const db = requireDb();
  const q = query(collection(db, "children"), where("teacherIds", "array-contains", teacherId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Child);
}

// -----------------------------------------------------------------------------
// Invite codes — багш шавиа нэмэх
// -----------------------------------------------------------------------------

export async function createInviteCode(teacherId: string, teacherName: string): Promise<string> {
  const db = requireDb();
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 хоног хүчинтэй

  await setDoc(doc(db, "inviteCodes", code), {
    code,
    teacherId,
    teacherName,
    used: false,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  } as InviteCode);

  return code;
}

export async function useInviteCode(code: string, childId: string): Promise<InviteCode | null> {
  const db = requireDb();
  const ref = doc(db, "inviteCodes", code.toUpperCase());
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data() as InviteCode;

  if (data.used) throw new Error("Энэ код аль хэдийн ашиглагдсан байна.");
  if (new Date(data.expiresAt) < new Date()) throw new Error("Кодын хугацаа дууссан байна.");

  // Хүүхдийн teacherIds жагсаалтад багшийг нэм
  const childRef = doc(db, "children", childId);
  const childSnap = await getDoc(childRef);
  if (!childSnap.exists()) throw new Error("Хүүхэд олдсонгүй.");

  const childData = childSnap.data() as Child;
  const teacherIds = childData.teacherIds ?? [];
  if (!teacherIds.includes(data.teacherId)) {
    await updateDoc(childRef, { teacherIds: [...teacherIds, data.teacherId] });
  }

  // Код ашигласан гэж тэмдэглэ
  await updateDoc(ref, { used: true, childId, usedAt: new Date().toISOString() });

  return { ...data, childId };
}

// -----------------------------------------------------------------------------
// Achievements
// -----------------------------------------------------------------------------

export async function createAchievement(childId: string, draft: AchievementDraft) {
  const db = requireDb();
  const storage = requireStorage();

  const imageURLs: string[] = await Promise.all(
    (draft.images ?? []).map(async (rawFile) => {
      const file = await compressImage(rawFile, { maxDimension: 1600, quality: 0.8 });
      const path = `achievements/${childId}/${Date.now()}_${safeName(file.name)}`;
      const snapshot = await uploadBytes(ref(storage, path), file);
      return getDownloadURL(snapshot.ref);
    })
  );

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

export async function updateAchievement(id: string, data: Partial<Achievement>) {
  const db = requireDb();
  await updateDoc(doc(db, "achievements", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAchievement(id: string) {
  const db = requireDb();
  await deleteDoc(doc(db, "achievements", id));
}

export function subscribeAchievements(
  childId: string,
  cb: (items: Achievement[]) => void,
  onError?: (err: unknown) => void
) {
  const db = requireDb();
  const q = query(collection(db, "achievements"), where("childId", "==", childId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(toAchievement).sort((a, b) => (a.date < b.date ? 1 : -1));
      cb(items);
    },
    (err) => {
      console.error("[champstep] achievements error:", err);
      onError?.(err);
    }
  );
}

function toAchievement(snap: QueryDocumentSnapshot<DocumentData>): Achievement {
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

export async function createPracticeLog(childId: string, log: Omit<PracticeLog, "id" | "childId" | "createdAt">) {
  const db = requireDb();
  const docRef = await addDoc(collection(db, "practiceLogs"), {
    childId,
    ...log,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deletePracticeLog(id: string) {
  const db = requireDb();
  await deleteDoc(doc(db, "practiceLogs", id));
}

export function subscribePracticeLogs(
  childId: string,
  cb: (items: PracticeLog[]) => void
) {
  const db = requireDb();
  const q = query(collection(db, "practiceLogs"), where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PracticeLog))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    cb(items);
  });
}

// -----------------------------------------------------------------------------
// Reflections — зөвхөн эцэг эх харна
// -----------------------------------------------------------------------------

export async function createReflection(
  childId: string,
  reflection: Omit<Reflection, "id" | "childId" | "createdAt">
) {
  const db = requireDb();
  const docRef = await addDoc(collection(db, "reflections"), {
    childId,
    ...reflection,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteReflection(id: string) {
  const db = requireDb();
  await deleteDoc(doc(db, "reflections", id));
}

export function subscribeReflections(
  childId: string,
  cb: (items: Reflection[]) => void
) {
  const db = requireDb();
  const q = query(collection(db, "reflections"), where("childId", "==", childId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Reflection))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    cb(items);
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Alias — App.tsx-тэй нийцтэй байлгах
export async function ensureChildDoc(child: Child) {
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
// Coach Notes — багшийн хувийн зөвлөгөө
// -----------------------------------------------------------------------------

export interface CoachNote {
  id: string;
  childId: string;
  teacherId: string;
  teacherName: string;
  note: string;
  createdAt: string;
}

export async function createCoachNote(
  childId: string,
  teacherId: string,
  teacherName: string,
  note: string
) {
  const db = requireDb();
  const docRef = await addDoc(collection(db, "coachNotes"), {
    childId,
    teacherId,
    teacherName,
    note,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteCoachNote(id: string) {
  const db = requireDb();
  await deleteDoc(doc(db, "coachNotes", id));
}

export function subscribeCoachNotes(
  childId: string,
  cb: (items: CoachNote[]) => void
) {
  const db = requireDb();
  const q = query(
    collection(db, "coachNotes"),
    where("childId", "==", childId)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CoachNote))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    cb(items);
  });
}