// js/auth.js
import { auth } from "../firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { db } from "../firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { saveProfile, saveActivity, logUserActivity } from "./firebase.js";

const provider = new GoogleAuthProvider();
let authInitialized = false;

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function getStoredTheme() {
  const value = localStorage.getItem('darkMode');
  return value === 'true' ? true : value === 'false' ? false : null;
}

export function setStoredTheme(isDark) {
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  applyTheme(isDark);
}

const storedTheme = getStoredTheme();
if (storedTheme !== null) {
  applyTheme(storedTheme);
}

export function initAuth() {
  if (authInitialized) return;
  authInitialized = true;
  const isAuthPage = location.pathname.includes("index.html") || location.pathname.endsWith("/");
  const existing = getCurrentUser();
  const demoSession = { uid: "demo-user", name: "Demo User", email: "demo@myfinance.app" };

  if (existing?.uid && existing.uid !== "demo-user") {
    sessionStorage.setItem("mf_user", JSON.stringify(existing));
    if (isAuthPage && !sessionStorage.getItem("mf_registration_in_progress")) location.href = "dashboard.html";
    return;
  }

  sessionStorage.setItem("mf_user", JSON.stringify(demoSession));
  localStorage.setItem("mf_user", JSON.stringify(demoSession));

  onAuthStateChanged(auth, user => {
    if (user) {
      const session = { uid: user.uid, name: user.displayName || "User", email: user.email };
      sessionStorage.setItem("mf_user", JSON.stringify(session));
      localStorage.setItem("mf_user", JSON.stringify(session));
      if (isAuthPage && !sessionStorage.getItem("mf_registration_in_progress")) location.href = "dashboard.html";
    } else if (isAuthPage) {
      sessionStorage.setItem("mf_user", JSON.stringify(demoSession));
      localStorage.setItem("mf_user", JSON.stringify(demoSession));
    }
  });
}

export async function registerUser(name, email, password) {
  // Prevent the auth-state listener from redirecting to the dashboard
  // while registration is still being completed.
  sessionStorage.setItem("mf_registration_in_progress", "1");
  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const userData = {
      uid: cred.user.uid,
      name,
      email,
      createdAt: serverTimestamp(),
      provider: "email"
    };
    const profileData = { name, email, phone: "", currency: "₦" };

    // Store the account and profile in Firestore before completing registration.
    await Promise.all([
      setDoc(doc(db, "users", cred.user.uid), userData, { merge: true }),
      setDoc(doc(db, "users", cred.user.uid, "profile", "main"), profileData, { merge: true })
    ]);

    // Keep the activity log from blocking the user's registration flow.
    logUserActivity({
      userId: cred.user.uid,
      action: "USER_REGISTERED",
      details: `Account created for ${name}`,
      metadata: { email, provider: "email" }
    }).catch(() => {});

    // Registration should NOT log the user in automatically.
    await signOut(auth);
    localStorage.removeItem("mf_user");
    sessionStorage.removeItem("mf_user");
    sessionStorage.removeItem("mf_registration_in_progress");
    sessionStorage.setItem("mf_registration_complete", "1");
    return cred.user;
  } catch (error) {
    sessionStorage.removeItem("mf_registration_in_progress");
    throw error;
  }
}

export async function loginUser(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const session = { uid: cred.user.uid, name: cred.user.displayName || "User", email: cred.user.email };
  if (remember) localStorage.setItem("mf_user", JSON.stringify(session));
  else sessionStorage.setItem("mf_user", JSON.stringify(session));
  await logUserActivity({
    userId: cred.user.uid,
    action: "USER_LOGIN",
    details: "User signed in via email",
    metadata: { email: cred.user.email, remember }
  });
  return cred.user;
}

export async function googleSignIn() {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithPopup(auth, provider);
  const session = { uid: cred.user.uid, name: cred.user.displayName || "User", email: cred.user.email };
  sessionStorage.setItem("mf_user", JSON.stringify(session));
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name: cred.user.displayName || "User",
    email: cred.user.email,
    createdAt: serverTimestamp(),
    provider: "google"
  }, { merge: true });
  await saveProfile(cred.user.uid, {
    name: cred.user.displayName || "User",
    email: cred.user.email,
    phone: cred.user.phoneNumber || "",
    currency: "₦"
  });
  await logUserActivity({
    userId: cred.user.uid,
    action: "USER_LOGIN",
    details: "User signed in with Google",
    metadata: { email: cred.user.email, provider: "google" }
  });
  return cred.user;
}

export async function logoutUser() {
  const currentUser = auth.currentUser;
  if (currentUser) {
    await logUserActivity({
      userId: currentUser.uid,
      action: "USER_LOGOUT",
      details: "User signed out",
      metadata: { email: currentUser.email }
    });
  }
  await signOut(auth);
  localStorage.removeItem("mf_user");
  sessionStorage.removeItem("mf_user");
  location.href = "index.html";
}

export function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("mf_user") || localStorage.getItem("mf_user") || "null");
}
