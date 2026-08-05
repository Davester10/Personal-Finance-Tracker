import { initAuth, getCurrentUser } from "./auth.js";
import {
  addTransaction,
  getTransactions,
  addGoal,
  getGoals,
  setBudget,
  getBudgets,
  getProfile,
  saveProfile,
  getSettings,
  saveSettings,
  showToast,
  todayDateString,
  getUserId
} from "./firebase.js";

initAuth();

function getInitialFromName(name = "User") {
  const value = String(name || "User").trim();
  if (!value) return "U";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'U';
}

function syncHeaderProfile(profileOverride = null) {
  const currentUser = getCurrentUser();
  const fallbackName = currentUser?.name || profileOverride?.name || 'User';
  const displayName = (profileOverride?.name && profileOverride.name !== 'User') ? profileOverride.name : fallbackName;
  const cleanName = String(displayName || 'User').trim() || 'User';
  const greeting = document.getElementById('greetingText');
  const avatar = document.getElementById('headerAvatar');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');

  if (greeting) {
    const hour = new Date().getHours();
    let label = 'Good morning';
    if (hour >= 12 && hour < 17) label = 'Good afternoon';
    if (hour >= 17) label = 'Good evening';
    greeting.textContent = `${label}, ${cleanName}!`;
  }

  if (avatar) avatar.textContent = getInitialFromName(cleanName);
  if (profileName && !profileName.value) profileName.value = cleanName;
  if (profileEmail && !profileEmail.value && currentUser?.email) profileEmail.value = currentUser.email;
}

async function bootstrapHeaderProfile() {
  const u = uid();
  if (!u) return;
  const profileData = await getProfile(u);
  syncHeaderProfile(profileData);
}

window.syncHeaderProfile = syncHeaderProfile;

function uid() {
  return getCurrentUser()?.uid || getUserId();
}

async function refreshAfterAction() {
  const u = uid();
  if (!u) return;
  try {
    const page = location.pathname.split('/').pop() || 'dashboard.html';
    if (page.includes('dashboard')) {
      if (typeof window.renderDashboard === 'function') {
        window.renderDashboard();
      }
    } else if (page.includes('income')) {
      if (typeof window.renderIncome === 'function') {
        window.renderIncome();
      }
    } else if (page.includes('expenses')) {
      if (typeof window.renderExpenses === 'function') {
        window.renderExpenses();
      }
    } else if (page.includes('transactions')) {
      if (typeof window.renderTransactions === 'function') {
        window.renderTransactions();
      }
    } else if (page.includes('budget')) {
      if (typeof window.renderBudget === 'function') {
        window.renderBudget();
      }
    } else if (page.includes('savings')) {
      if (typeof window.renderSavings === 'function') {
        window.renderSavings();
      }
    } else if (page.includes('reports')) {
      if (typeof window.renderReports === 'function') {
        window.renderReports();
      }
    }
  } catch (_) {}
}

function resetTransactionForm() {
  const txType = document.getElementById('txType');
  const txAmount = document.getElementById('txAmount');
  const txDesc = document.getElementById('txDesc');
  const txCategory = document.getElementById('txCategory');
  const txDate = document.getElementById('txDate');
  const txNote = document.getElementById('txNote');

  if (txType) txType.value = 'income';
  if (txAmount) txAmount.value = '';
  if (txDesc) txDesc.value = '';
  if (txCategory) txCategory.value = 'Food';
  if (txDate) txDate.value = todayDateString();
  if (txNote) txNote.value = '';
}

window.resetTransactionForm = resetTransactionForm;
window.resetBudgetForm = function() {
  const category = document.getElementById('budgetCategory');
  const limit = document.getElementById('budgetLimit');

  if (category) category.value = 'Food';
  if (limit) limit.value = '';
};
window.resetSavingsGoalForm = function() {
  const name = document.getElementById('goalName');
  const target = document.getElementById('goalTarget');
  const saved = document.getElementById('goalSaved');
  const desc = document.getElementById('goalDesc');

  if (name) name.value = '';
  if (target) target.value = '';
  if (saved) saved.value = '';
  if (desc) desc.value = '';
};
window.resetAddFundsForm = function() {
  const amount = document.getElementById('addFundsAmount');
  const note = document.getElementById('addFundsNote');

  if (amount) amount.value = '';
  if (note) note.value = '';
};

function resetBudgetForm() {
  const category = document.getElementById('budgetCategory');
  const limit = document.getElementById('budgetLimit');

  if (category) category.value = 'Food';
  if (limit) limit.value = '';
}

function resetSavingsGoalForm() {
  const name = document.getElementById('goalName');
  const target = document.getElementById('goalTarget');
  const saved = document.getElementById('goalSaved');
  const desc = document.getElementById('goalDesc');

  if (name) name.value = '';
  if (target) target.value = '';
  if (saved) saved.value = '';
  if (desc) desc.value = '';
}

function resetAddFundsForm() {
  const amount = document.getElementById('addFundsAmount');
  const note = document.getElementById('addFundsNote');

  if (amount) amount.value = '';
  if (note) note.value = '';
}

window.saveTransaction = async function() {
  const type = document.getElementById('txType')?.value || 'expense';
  const amount = parseFloat(document.getElementById('txAmount')?.value);
  const desc = document.getElementById('txDesc')?.value?.trim() || '';
  const category = document.getElementById('txCategory')?.value || 'Others';
  const date = document.getElementById('txDate')?.value || todayDateString();
  const note = document.getElementById('txNote')?.value.trim();

  if (!amount || amount <= 0) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid amount');
    return;
  }
  if (!desc) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a description');
    return;
  }

  const u = uid();
  if (!u) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Unable to save transaction');
    return;
  }

  const txs = await getTransactions(u);
  const balance = txs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0) - txs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  if (type === 'expense' && amount > balance) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Insufficient funds');
    return;
  }

  await addTransaction(u, { type, amount, desc, category, date, note });
  closeModal('txModal');
  resetTransactionForm();
  showToast(type === 'income' ? '<i class="fa-solid fa-money-bill-wave"></i> Income added!' : '<i class="fa-solid fa-wallet"></i> Expense added!');
  await refreshAfterAction();
};

window.saveBudget = async function() {
  const category = document.getElementById('budgetCategory')?.value || 'Others';
  const limit = parseFloat(document.getElementById('budgetLimit')?.value);
  if (!limit || limit <= 0) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid limit');
    return;
  }

  const u = uid();
  if (!u) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Unable to save budget');
    return;
  }

  await setBudget(u, { category, limit });
  closeModal('budgetModal');
  resetBudgetForm();
  showToast('<i class="fa-solid fa-bullseye"></i> Budget saved!');
  await refreshAfterAction();
};

window.saveSavingsGoal = async function() {
  const name = document.getElementById('goalName')?.value.trim();
  const target = parseFloat(document.getElementById('goalTarget')?.value);
  const saved = parseFloat(document.getElementById('goalSaved')?.value) || 0;
  const desc = document.getElementById('goalDesc')?.value.trim();

  if (!name) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a goal name');
    return;
  }
  if (!target || target <= 0) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid target');
    return;
  }

  const u = uid();
  if (!u) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Unable to save goal');
    return;
  }

  const goalData = { name, target, saved, desc };
  if (saved > 0) {
    const txs = await getTransactions(u);
    const balance = txs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0) - txs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    if (saved > balance) {
      showToast('<i class="fa-solid fa-circle-exclamation"></i> Not enough balance');
      return;
    }
  }

  await addGoal(u, goalData);
  closeModal('savingsModal');
  resetSavingsGoalForm();
  showToast('<i class="fa-solid fa-piggy-bank"></i> Goal created!');
  await refreshAfterAction();
};

window.saveProfile = async function() {
  const u = uid();
  if (!u) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Unable to save profile');
    return;
  }

  const data = {
    name: document.getElementById('profileName')?.value.trim() || 'User',
    email: document.getElementById('profileEmail')?.value.trim(),
    phone: document.getElementById('profilePhone')?.value.trim(),
    currency: document.getElementById('profileCurrency')?.value || '₦'
  };

  await saveProfile(u, data);
  syncHeaderProfile(data);
  showToast('<i class="fa-solid fa-check"></i> Profile saved!');
  const avatar = document.getElementById('profileAvatarBig');
  if (avatar) avatar.textContent = getInitialFromName(data.name);
  await refreshAfterAction();
};

window.toggleDarkMode = async function() {
  const isDark = document.getElementById('darkModeToggle')?.checked;
  const u = uid();
  if (u) {
    await saveSettings(u, { darkMode: isDark });
  }
  showToast(isDark ? '<i class="fa-solid fa-moon"></i> Dark mode on' : '<i class="fa-solid fa-sun"></i> Light mode on');
};

bootstrapHeaderProfile();
