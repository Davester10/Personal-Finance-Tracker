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

// In-memory cache avoids repeatedly parsing localStorage during the same page session.
const memoryCache = new Map();
const backgroundRefreshes = new Set();

export async function logUserActivity({ userId, action, details = {}, metadata = {} }) {
  const safeUserId = String(userId || "anonymous");
  const payload = {
    userId: safeUserId,
    action: String(action || "UNKNOWN_ACTION"),
    details: typeof details === "string" ? details : details ?? {},
    metadata: metadata ?? {},
    timestamp: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "activity_logs"), payload);
  } catch (error) {
    console.warn("Failed to log activity:", error);
    try {
      const key = `${STORAGE_PREFIX}:activity_logs:${safeUserId}`;
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      saved.unshift({ ...payload, timestamp: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 200)));
    } catch (_) { }
  }
}

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
  const cacheKey = getStorageKey(uid, key);
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
  try {
    const stored = localStorage.getItem(cacheKey);
    const value = stored ? JSON.parse(stored) : fallback;
    memoryCache.set(cacheKey, value);
    return value;
  } catch {
    return fallback;
  }
}

function saveStoredCollection(uid, key, data) {
  const cacheKey = getStorageKey(uid, key);
  memoryCache.set(cacheKey, data);
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) { }
}

export async function saveActivity(uid, action, message, meta = {}) {
  const activeUid = getActiveUid(uid);
  await logUserActivity({
    userId: activeUid,
    action,
    details: message,
    metadata: meta
  });

  try {
    const list = readStoredCollection(activeUid, "activity");
    saveStoredCollection(activeUid, "activity", [
      {
        action,
        message,
        meta,
        createdAt: new Date().toISOString()
      },
      ...list
    ].slice(0, 200));
  } catch { }
}

function refreshInBackground(uid, key, loaderFn) {
  const refreshKey = `${uid || DEMO_UID}:${key}`;
  if (backgroundRefreshes.has(refreshKey)) return;
  backgroundRefreshes.add(refreshKey);
  loaderFn()
    .then(data => { if (data) saveStoredCollection(uid, key, data); })
    .catch(() => { })
    .finally(() => backgroundRefreshes.delete(refreshKey));
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- Profile ---------- */
export async function getProfile(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "profile");

  if (hasStoredCollection(activeUid, "profile")) {
    refreshInBackground(activeUid, "profile", async () => {
      const [profileSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "users", activeUid, "profile", "main")),
        getDoc(doc(db, "users", activeUid))
      ]);
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      const userData = userSnap.exists() ? userSnap.data() : {};
      return { ...PROFILE_FALLBACK, ...userData, ...profileData };
    });
    return cached;
  }

  try {
    const [profileSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "users", activeUid, "profile", "main")),
      getDoc(doc(db, "users", activeUid))
    ]);
    const profileData = profileSnap.exists() ? profileSnap.data() : {};
    const userData = userSnap.exists() ? userSnap.data() : {};
    const data = { ...PROFILE_FALLBACK, ...userData, ...profileData };
    saveStoredCollection(activeUid, "profile", data);
    return data;
  } catch {
    return cached;
  }
}
export async function saveProfile(uid, data) {
  const activeUid = getActiveUid(uid);
  try {
    await setDoc(doc(db, "users", activeUid), {
      uid: activeUid,
      name: data.name || "User",
      email: data.email || "",
      phone: data.phone || "",
      currency: data.currency || "₦"
    }, { merge: true });
    await setDoc(doc(db, "users", activeUid, "profile", "main"), data, { merge: true });
    await saveActivity(activeUid, "profile_updated", `Profile updated for ${data.name || 'User'}`, { email: data.email || '' });
  } catch {
    saveStoredCollection(activeUid, "profile", data);
    await saveActivity(activeUid, "profile_updated", `Profile updated for ${data.name || 'User'}`, { email: data.email || '' });
  }
}

/* ---------- Settings ---------- */
export async function getSettings(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "settings");

  if (hasStoredCollection(activeUid, "settings")) {
    refreshInBackground(activeUid, "settings", async () => {
      const snap = await getDoc(doc(db, "users", activeUid, "settings", "main"));
      return snap.exists() ? snap.data() : cached;
    });
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
    await saveActivity(activeUid, "settings_updated", `Settings updated`, data);
  } catch {
    saveStoredCollection(activeUid, "settings", data);
    await saveActivity(activeUid, "settings_updated", `Settings updated`, data);
  }
}

/* ---------- Transactions ---------- */
export async function getTransactions(uid, options = {}) {
  const activeUid = getActiveUid(uid);
  const forceRefresh = Boolean(options.forceRefresh);
  const cached = [...readStoredCollection(activeUid, "transactions", [])]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const loadFromFirestore = async () => {
    const q = query(collection(db, "users", activeUid, "transactions"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  if (!forceRefresh && hasStoredCollection(activeUid, "transactions")) {
    refreshInBackground(activeUid, "transactions", loadFromFirestore);
    return cached;
  }

  try {
    const list = await loadFromFirestore();
    saveStoredCollection(activeUid, "transactions", list);
    return list;
  } catch {
    return cached;
  }
}

export async function getAvailableBalance(uid, options = {}) {
  const transactions = await getTransactions(uid, options);
  return transactions.reduce((balance, tx) => {
    const amount = Number(tx.amount) || 0;
    return balance + (tx.type === "income" ? amount : tx.type === "expense" ? -amount : 0);
  }, 0);
}

export async function addTransaction(uid, tx) {
  const activeUid = getActiveUid(uid);
  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  // Every expense, including savings transfers, must pass the same balance check.
  // We refresh from Firestore at save time so a stale browser cache cannot approve an expense.
  if (tx.type === "expense") {
    const balance = await getAvailableBalance(activeUid, { forceRefresh: true });
    if (balance <= 0 || amount >= balance) {
      const error = new Error("Insufficient funds");
      error.code = "INSUFFICIENT_FUNDS";
      error.availableBalance = balance;
      throw error;
    }
  }

  try {
    const docRef = await addDoc(collection(db, "users", activeUid, "transactions"), {
      ...tx,
      amount,
      userId: activeUid,
      createdAt: serverTimestamp()
    });

    const current = readStoredCollection(activeUid, "transactions", []);
    saveStoredCollection(activeUid, "transactions", [
      { id: docRef.id, ...tx, amount, userId: activeUid },
      ...current.filter(item => item.id !== docRef.id)
    ]);

    logUserActivity({
      userId: activeUid,
      action: "transaction_added",
      details: `${tx.type === 'income' ? 'Income' : 'Expense'} added: ${tx.desc}`,
      metadata: { txId: docRef.id, amount, category: tx.category, date: tx.date }
    }).catch(() => { });
    return docRef;
  } catch (error) {
    if (error?.code === "INSUFFICIENT_FUNDS") throw error;
    const list = readStoredCollection(activeUid, "transactions", []);
    const item = { id: createId(), ...tx, amount, createdAt: new Date().toISOString() };
    saveStoredCollection(activeUid, "transactions", [item, ...list]);
    logUserActivity({
      userId: activeUid,
      action: "transaction_added",
      details: `${tx.type === 'income' ? 'Income' : 'Expense'} added: ${tx.desc}`,
      metadata: { txId: item.id, amount, category: tx.category, date: tx.date }
    }).catch(() => { });
    return item;
  }
}
export async function updateTransaction(uid, id, tx) {
  const activeUid = getActiveUid(uid);
  try {
    await updateDoc(doc(db, "users", activeUid, "transactions", id), tx);
    const list = readStoredCollection(activeUid, "transactions", []);
    saveStoredCollection(activeUid, "transactions", list.map(item => item.id === id ? { ...item, ...tx } : item));
    await saveActivity(activeUid, "transaction_updated", `Transaction updated`, { txId: id, ...tx });
  } catch {
    const list = readStoredCollection(activeUid, "transactions");
    saveStoredCollection(activeUid, "transactions", list.map(item => item.id === id ? { ...item, ...tx } : item));
    await saveActivity(activeUid, "transaction_updated", `Transaction updated`, { txId: id, ...tx });
  }
}
export async function deleteTransaction(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "transactions", id));
    const list = readStoredCollection(activeUid, "transactions", []);
    saveStoredCollection(activeUid, "transactions", list.filter(item => item.id !== id));
    await saveActivity(activeUid, "transaction_deleted", `Transaction deleted`, { txId: id });
  } catch {
    const list = readStoredCollection(activeUid, "transactions");
    saveStoredCollection(activeUid, "transactions", list.filter(item => item.id !== id));
    await saveActivity(activeUid, "transaction_deleted", `Transaction deleted`, { txId: id });
  }
}

/* ---------- Budgets ---------- */
export async function getBudgets(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "budgets");

  if (hasStoredCollection(activeUid, "budgets")) {
    refreshInBackground(activeUid, "budgets", async () => {
      const snap = await getDocs(collection(db, "users", activeUid, "budgets"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
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
      const docRef = await addDoc(collection(db, "users", activeUid, "budgets"), data);
      await saveActivity(activeUid, "budget_created", `Budget created for ${data.category}`, { budgetId: docRef.id, ...data });
      return docRef;
    } else {
      await updateDoc(doc(db, "users", activeUid, "budgets", existing.docs[0].id), { limit: data.limit });
      await saveActivity(activeUid, "budget_updated", `Budget updated for ${data.category}`, { budgetId: existing.docs[0].id, ...data });
      return existing.docs[0].id;
    }
  } catch {
    const list = readStoredCollection(activeUid, "budgets");
    const existing = list.find(item => item.category === data.category);
    if (existing) {
      const updated = list.map(item => item.category === data.category ? { ...item, limit: data.limit } : item);
      saveStoredCollection(activeUid, "budgets", updated);
      await saveActivity(activeUid, "budget_updated", `Budget updated for ${data.category}`, { budgetId: existing.id, ...data });
      return existing.id;
    }
    const item = { id: createId(), ...data };
    saveStoredCollection(activeUid, "budgets", [item, ...list]);
    await saveActivity(activeUid, "budget_created", `Budget created for ${data.category}`, { budgetId: item.id, ...data });
    return item.id;
  }
}
export async function deleteBudget(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "budgets", id));
    await saveActivity(activeUid, "budget_deleted", `Budget deleted`, { budgetId: id });
  } catch {
    const list = readStoredCollection(activeUid, "budgets");
    saveStoredCollection(activeUid, "budgets", list.filter(item => item.id !== id));
    await saveActivity(activeUid, "budget_deleted", `Budget deleted`, { budgetId: id });
  }
}

/* ---------- Goals ---------- */
export async function getGoals(uid) {
  const activeUid = getActiveUid(uid);
  const cached = readStoredCollection(activeUid, "goals");

  if (hasStoredCollection(activeUid, "goals")) {
    refreshInBackground(activeUid, "goals", async () => {
      const snap = await getDocs(collection(db, "users", activeUid, "goals"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
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
    const docRef = await addDoc(collection(db, "users", activeUid, "goals"), goal);
    await saveActivity(activeUid, "goal_created", `Goal created: ${goal.name}`, { goalId: docRef.id, ...goal });
    return docRef;
  } catch {
    const list = readStoredCollection(activeUid, "goals");
    const item = { id: createId(), ...goal };
    saveStoredCollection(activeUid, "goals", [item, ...list]);
    await saveActivity(activeUid, "goal_created", `Goal created: ${goal.name}`, { goalId: item.id, ...goal });
    return item;
  }
}
export async function updateGoal(uid, id, data) {
  const activeUid = getActiveUid(uid);
  try {
    await updateDoc(doc(db, "users", activeUid, "goals", id), data);
    await saveActivity(activeUid, "goal_updated", `Goal updated`, { goalId: id, ...data });
  } catch {
    const list = readStoredCollection(activeUid, "goals");
    saveStoredCollection(activeUid, "goals", list.map(item => item.id === id ? { ...item, ...data } : item));
    await saveActivity(activeUid, "goal_updated", `Goal updated`, { goalId: id, ...data });
  }
}
export async function deleteGoal(uid, id) {
  const activeUid = getActiveUid(uid);
  try {
    await deleteDoc(doc(db, "users", activeUid, "goals", id));
    await saveActivity(activeUid, "goal_deleted", `Goal deleted`, { goalId: id });
  } catch {
    const list = readStoredCollection(activeUid, "goals");
    saveStoredCollection(activeUid, "goals", list.filter(item => item.id !== id));
    await saveActivity(activeUid, "goal_deleted", `Goal deleted`, { goalId: id });
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
  if (typeof window !== 'undefined' && window.SmartAlerts) {
    const plainText = typeof msg === 'string' ? msg.replace(/<[^>]*>/g, '').trim() : String(msg);
    window.SmartAlerts.show({
      title: 'Activity',
      message: msg,
      type: 'info',
      icon: 'fa-bell',
      sound: false,
      record: false
    });
  }
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}
