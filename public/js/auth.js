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
import { saveProfile } from "./firebase.js";

const provider = new GoogleAuthProvider();

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
  const isAuthPage = location.pathname.includes("index.html") || location.pathname.endsWith("/");
  const existing = getCurrentUser();
  const demoSession = { uid: "demo-user", name: "Demo User", email: "demo@myfinance.app" };

  if (existing?.uid && existing.uid !== "demo-user") {
    sessionStorage.setItem("mf_user", JSON.stringify(existing));
    if (isAuthPage) location.href = "dashboard.html";
    return;
  }

  sessionStorage.setItem("mf_user", JSON.stringify(demoSession));
  localStorage.setItem("mf_user", JSON.stringify(demoSession));

  onAuthStateChanged(auth, user => {
    if (user) {
      const session = { uid: user.uid, name: user.displayName || "User", email: user.email };
      sessionStorage.setItem("mf_user", JSON.stringify(session));
      localStorage.setItem("mf_user", JSON.stringify(session));
      if (isAuthPage) location.href = "dashboard.html";
    } else if (isAuthPage) {
      sessionStorage.setItem("mf_user", JSON.stringify(demoSession));
      localStorage.setItem("mf_user", JSON.stringify(demoSession));
    }
  });
}

export async function registerUser(name, email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    createdAt: serverTimestamp(),
    provider: "email"
  }, { merge: true });
  await saveProfile(cred.user.uid, { name, email, phone: "", currency: "₦" });

  const session = { uid: cred.user.uid, name, email };
  sessionStorage.setItem("mf_user", JSON.stringify(session));
  localStorage.setItem("mf_user", JSON.stringify(session));
  return cred.user;
}

export async function loginUser(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const session = { uid: cred.user.uid, name: cred.user.displayName || "User", email: cred.user.email };
  if (remember) localStorage.setItem("mf_user", JSON.stringify(session));
  else sessionStorage.setItem("mf_user", JSON.stringify(session));
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
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
  localStorage.removeItem("mf_user");
  sessionStorage.removeItem("mf_user");
  location.href = "index.html";
}

export function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("mf_user") || localStorage.getItem("mf_user") || "null");
}
