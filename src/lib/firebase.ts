// =============================================================================
// Firebase client — init + DB/Storage/Auth helpers.
// Collection layout:
//   /users/{uid}                             ← parent user profile + sub status
//   /children/{childId}                      ← Child profile document
//   /achievements/{docId}                    ← Flat collection, filtered by childId
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
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
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

import type { Achievement, AchievementDraft, Child, SubscriptionStatus } from "../types";
import { compressImage } from "../utils/image";

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
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
  if (!_db) throw new Error("Firebase is not configured. Check your .env file.");
  return _db;
}
function requireStorage(): FirebaseStorage {
  if (!_storage) throw new Error("Firebase Storage is not configured.");
  return _storage;
}
function requireAuth(): Auth {
  if (!_auth) throw new Error("Firebase Auth is not configured.");
  return _auth;
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(requireAuth(), provider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signOut() {
  await fbSignOut(requireAuth());
}

export function onAuthChange(cb: (user: FirebaseUser | null) => void) {
  if (!_auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, cb);
}

/** Creates /users/{uid} if missing. Default subscription is "free". */
export async function ensureUserDoc(user: FirebaseUser) {
  const db = requireDb();
  const refDoc = doc(db, "users", user.uid);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) {
    await setDoc(refDoc, {
      userId: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      subscriptionStatus: "free" as SubscriptionStatus,
      createdAt: serverTimestamp(),
    });
  }
}

export async function getSubscriptionStatus(uid: string): Promise<SubscriptionStatus> {
  const db = requireDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "free";
  const data = snap.data();
  return (data.subscriptionStatus as SubscriptionStatus) ?? "free";
}

/**
 * Demo-only subscription activator.
 * In production this would be called by a Cloud Function after verifying
 * the QPay webhook. Here we just flip the user doc.
 */
export async function activatePremium(uid: string, months = 1) {
  const db = requireDb();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);
  await updateDoc(doc(db, "users", uid), {
    subscriptionStatus: "premium",
    subscriptionActivatedAt: serverTimestamp(),
    subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
  });
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
      console.error("[champstep] achievements subscription error:", err);
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

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

// -----------------------------------------------------------------------------
// Child profile
// -----------------------------------------------------------------------------

export async function ensureChildDoc(child: Child) {
  const db = requireDb();
  const refDoc = doc(db, "children", child.childId);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) {
    await setDoc(refDoc, {
      childId: child.childId,
      parentId: child.parentId,
      name: child.name,
      birthDate: child.birthDate,
      bio: child.bio ?? "",
      avatarUrl: child.avatarUrl ?? null,
      createdAt: serverTimestamp(),
    });
  }
}

export async function updateChild(next: Child, avatarFile?: File) {
  const db = requireDb();
  const refDoc = doc(db, "children", next.childId);

  let avatarUrl = next.avatarUrl;
  if (avatarFile) {
    const storage = requireStorage();
    const path = `avatars/${next.childId}/${Date.now()}_${safeName(avatarFile.name)}`;
    const snap = await uploadBytes(ref(storage, path), avatarFile);
    avatarUrl = await getDownloadURL(snap.ref);
  }

  await updateDoc(refDoc, {
    name: next.name,
    birthDate: next.birthDate,
    bio: next.bio ?? "",
    avatarUrl: avatarUrl ?? null,
    updatedAt: serverTimestamp(),
  });

  return { ...next, avatarUrl };
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
