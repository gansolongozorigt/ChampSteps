// =============================================================================
// nativeAuth — Google / Apple sign-in inside the Capacitor app.
// The native SDK (@capacitor-firebase/authentication) returns an ID token; we
// hand it to the Firebase JS SDK with signInWithCredential so the existing
// auth.tsx flow (users/{uid} doc, role, listeners) stays untouched.
// Apple: code ready, hidden behind VITE_APPLE_SIGNIN=1 until the Developer account exists.
// =============================================================================

import { GoogleAuthProvider, OAuthProvider, signInWithCredential, type Auth, type User } from "firebase/auth";

export const APPLE_SIGNIN_ENABLED = import.meta.env.VITE_APPLE_SIGNIN === "1";

async function plugin() {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  return FirebaseAuthentication;
}

export async function nativeSignInWithGoogle(auth: Auth): Promise<User> {
  const fa = await plugin();
  const result = await fa.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("auth/native-no-credential");
  const cred = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
  return (await signInWithCredential(auth, cred)).user;
}

export async function nativeSignInWithApple(auth: Auth): Promise<User> {
  const fa = await plugin();
  const result = await fa.signInWithApple({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("auth/native-no-credential");
  const provider = new OAuthProvider("apple.com");
  const cred = provider.credential({ idToken, rawNonce: result.credential?.nonce });
  return (await signInWithCredential(auth, cred)).user;
}

/** Sign out of the native SDK too (Google session), after the JS SDK. */
export async function nativeSignOut(): Promise<void> {
  try { await (await plugin()).signOut(); } catch { /* nothing signed in natively */ }
}
