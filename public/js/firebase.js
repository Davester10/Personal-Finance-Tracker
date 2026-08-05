// js/firebase.js
import { db } from "../firebase-config.js";
import {
  collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const STORAGE_PREFIX = "myfinance-demo";
const DEMO_UID = "demo-user";
const PROFILE_FALLBACK = { name: "User", email: "", phone: "", currency: "₦" };
const SETTINGS_FALLBACK = { darkMode: false };

const getUserId = () => {
  const user = JSON.parse(sessionStorage.getItem("mf_user") || localStorage.getItem("mf_user") || "null");
  return user?.uid || DEMO_UID;
};

function getActiveUid(uid) {
  return uid || getUserId();
}

function getStorageKey(uid, key) {
  return `${STORAGE_PREFIX}:${uid || DEMO_UID}:${key}`;
}

function hasStoredCollection(uid, key) {
  return localStorage.getItem(getStorageKey(uid, key)) !== null;
}

function readStoredCollection(uid, key, fallback = []) {
  try {
    const stored = localStorage.getItem(getStorageKey(uid, key));
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredCollection(uid, key, data) {
  localStorage.setItem(getStorageKey(uid, key), JSON.stringify(data));
}

function refreshInBackground(uid, key, loaderFn, fallback) {
  if (!hasStoredCollection(uid, key)) return;
  loaderFn().catch(() => {}).then(data => {
    if (data) saveStoredCollection(uid, key, data);
  });
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- Profile ---------- */
export async function getProfile(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "profile", PROFILE_FALLBACK);

  if (hasStoredCollection(activeUid, "profile")) {
    refreshInBackground(activeUid, "profile", async () => {
      const snap = await getDoc(doc(db, "users", activeUid, "profile", "main"));
      return snap.exists() ? snap.data() : cached;
    }, PROFILE_FALLBACK);
    return cached;
  }

  try {
    const snap = await getDoc(doc(db, "users", activeUid, "profile", "main"));
    const data = snap.exists() ? snap.data() : PROFILE_FALLBACK;
    saveStoredCollection(activeUid, "profile", data);
    return data;
  } catch {
    return cached;
  }
}
export async function saveProfile(uid, data) {
  const activeUid = getActiveUid(uid);
  try {
    await setDoc(doc(db, "users", activeUid, "profile", "main"), data, { merge: true });
  } catch {
    saveStoredCollection(activeUid, "profile", data);
  }
}

/* ---------- Settings ---------- */
export async function getSettings(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "settings", SETTINGS_FALLBACK);

  if (hasStoredCollection(activeUid, "settings")) {
    refreshInBackground(activeUid, "settings", async () => {
      const snap = await getDoc(doc(db, "users", activeUid, "settings", "main"));
      return snap.exists() ? snap.data() : cached;
    }, SETTINGS_FALLBACK);
    return cached;
  }

  try {
    const snap = await getDoc(doc(db, "users", activeUid, "settings", "main"));
    const data = snap.exists() ? snap.data() : SETTINGS_FALLBACK;
    saveStoredCollection(activeUid, "settings", data);
    return data;
  } catch {
    return cached;
  }
}
export async function saveSettings(uid, data) {
  const activeUid = getActiveUid(uid);
  try {
    await setDoc(doc(db, "users", activeUid, "settings", "main"), data, { merge: true });
  } catch {
    saveStoredCollection(activeUid, "settings", data);
  }
}

/* ---------- Transactions ---------- */
export async function getTransactions(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "transactions", []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (hasStoredCollection(activeUid, "transactions")) {
    refreshInBackground(activeUid, "transactions", async () => {
      const q = query(collection(db, "users", activeUid, "transactions"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    return cached;
  }

  try {
    const q = query(collection(db, "users", activeUid, "transactions"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveStoredCollection(activeUid, "transactions", list);
    return list;
  } catch {
    return cached;
  }
}
export async function addTransaction(uid, tx) {
  const activeUid = getActiveUid(uid);
  try {
    return await addDoc(collection(db, "users", activeUid, "transactions"), {
      ...tx,
      createdAt: serverTimestamp()
    });
  } catch {
    const list = readStoredCollection(activeUid, "transactions", []);
    const item = { id: createId(), ...tx, createdAt: new Date().toISOString() };
    saveStoredCollection(activeUid, "transactions", [item, ...list]);
    return item;
  }
}
export async function updateTransaction(uid, id, tx) {
  const activeUid = getActiveUid(uid);
  try {
    await updateDoc(doc(db, "users", activeUid, "transactions", id), tx);
  } catch {
    const list = readStoredCollection(activeUid, "transactions", []);
    saveStoredCollection(activeUid, "transactions", list.map(item => item.id === id ? { ...item, ...tx } : item));
  }
}
export async function deleteTransaction(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "transactions", id));
  } catch {
    const list = readStoredCollection(activeUid, "transactions", []);
    saveStoredCollection(activeUid, "transactions", list.filter(item => item.id !== id));
  }
}

/* ---------- Budgets ---------- */
export async function getBudgets(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "budgets", []);

  if (hasStoredCollection(activeUid, "budgets")) {
    refreshInBackground(activeUid, "budgets", async () => {
      const snap = await getDocs(collection(db, "users", activeUid, "budgets"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    return cached;
  }

  try {
    const snap = await getDocs(collection(db, "users", activeUid, "budgets"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveStoredCollection(activeUid, "budgets", list);
    return list;
  } catch {
    return cached;
  }
}
export async function setBudget(uid, data) {
  const activeUid = getActiveUid(uid);
  try {
    const existing = await getDocs(query(collection(db, "users", activeUid, "budgets"), where("category", "==", data.category)));
    if (existing.empty) {
      return await addDoc(collection(db, "users", activeUid, "budgets"), data);
    } else {
      await updateDoc(doc(db, "users", activeUid, "budgets", existing.docs[0].id), { limit: data.limit });
      return existing.docs[0].id;
    }
  } catch {
    const list = readStoredCollection(activeUid, "budgets", []);
    const existing = list.find(item => item.category === data.category);
    if (existing) {
      const updated = list.map(item => item.category === data.category ? { ...item, limit: data.limit } : item);
      saveStoredCollection(activeUid, "budgets", updated);
      return existing.id;
    }
    const item = { id: createId(), ...data };
    saveStoredCollection(activeUid, "budgets", [item, ...list]);
    return item.id;
  }
}
export async function deleteBudget(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "budgets", id));
  } catch {
    const list = readStoredCollection(activeUid, "budgets", []);
    saveStoredCollection(activeUid, "budgets", list.filter(item => item.id !== id));
  }
}

/* ---------- Goals ---------- */
export async function getGoals(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "goals", []);

  if (hasStoredCollection(activeUid, "goals")) {
    refreshInBackground(activeUid, "goals", async () => {
      const snap = await getDocs(collection(db, "users", activeUid, "goals"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    return cached;
  }

  try {
    const snap = await getDocs(collection(db, "users", activeUid, "goals"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveStoredCollection(activeUid, "goals", list);
    return list;
  } catch {
    return cached;
  }
}
export async function addGoal(uid, goal) {
  const activeUid = getActiveUid(uid);
  try {
    return await addDoc(collection(db, "users", activeUid, "goals"), goal);
  } catch {
    const list = readStoredCollection(activeUid, "goals", []);
    const item = { id: createId(), ...goal };
    saveStoredCollection(activeUid, "goals", [item, ...list]);
    return item;
  }
}
export async function updateGoal(uid, id, data) {
  const activeUid = getActiveUid(uid);
  try {
    await updateDoc(doc(db, "users", activeUid, "goals", id), data);
  } catch {
    const list = readStoredCollection(activeUid, "goals", []);
    saveStoredCollection(activeUid, "goals", list.map(item => item.id === id ? { ...item, ...data } : item));
  }
}
export async function deleteGoal(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "goals", id));
  } catch {
    const list = readStoredCollection(activeUid, "goals", []);
    saveStoredCollection(activeUid, "goals", list.filter(item => item.id !== id));
  }
}

/* ---------- Utilities ---------- */
export { getUserId };
export function formatCurrency(amount, sym = "₦") {
  return sym + (amount || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
export function todayDateString() {
  return new Date().toISOString().split("T")[0];
}
export function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}
