// js/app-helpers.js
import { initAuth, getCurrentUser, setStoredTheme, getStoredTheme } from "./auth.js";
import { AppState, Router } from "./app-core.js";
import { SmartAlerts } from "./smart-alerts.js";
import { todayDateString, formatCurrency, formatDate } from "./firebase.js";

initAuth();

function uid() {
  return getCurrentUser()?.uid || 'demo-user';
}

// In-flight request guards to disable multiple submissions on click
let isSubmittingTx = false;
let isSubmittingBudget = false;
let isSubmittingGoal = false;
let isSubmittingFunds = false;
let isSubmittingProfile = false;

// Boot AppState immediately
const activeUser = getCurrentUser();
if (activeUser?.uid) {
  AppState.init(activeUser.uid).then(() => {
    syncHeaderProfile(AppState.profile);
    ensureHeaderCalendarSync();
    refreshActiveView();
  });
} else {
  AppState.init('demo-user').then(() => {
    syncHeaderProfile(AppState.profile);
    ensureHeaderCalendarSync();
    refreshActiveView();
  });
}

function ensureHeaderCalendarSync() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  if (!monthEl || !yearEl) return;
  if (monthEl.options.length > 0) return; // already populated by page script

  const sM = sessionStorage.getItem('mf_filter_month');
  const sY = sessionStorage.getItem('mf_filter_year');
  const filterMonth = (sM !== null && !isNaN(parseInt(sM))) ? parseInt(sM) : new Date().getMonth();
  const filterYear = (sY !== null && !isNaN(parseInt(sY))) ? parseInt(sY) : new Date().getFullYear();

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthEl.innerHTML = '';
  months.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = m;
    if (i === filterMonth) o.selected = true;
    monthEl.appendChild(o);
  });

  yearEl.innerHTML = '';
  const cy = new Date().getFullYear();
  for (let y = cy - 3; y <= cy + 1; y++) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
    if (y === filterYear) o.selected = true;
    yearEl.appendChild(o);
  }

  monthEl.onchange = () => {
    sessionStorage.setItem('mf_filter_month', parseInt(monthEl.value));
    refreshActiveView();
  };
  yearEl.onchange = () => {
    sessionStorage.setItem('mf_filter_year', parseInt(yearEl.value));
    refreshActiveView();
  };
}

window.ensureHeaderCalendarSync = ensureHeaderCalendarSync;

function getInitialFromName(name = "User") {
  const value = String(name || "User").trim();
  if (!value) return "U";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'U';
}

function syncHeaderProfile(profileOverride = null) {
  const currentUser = getCurrentUser();
  const profile = profileOverride || AppState.profile;
  const fallbackName = currentUser?.name || profile?.name || 'User';
  const displayName = (profile?.name && profile.name !== 'User') ? profile.name : fallbackName;
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

window.syncHeaderProfile = syncHeaderProfile;

// Global reactive updates across views
AppState.on('state:changed', () => {
  refreshActiveView();
});

function refreshActiveView() {
  const page = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
  try {
    if (page === 'dashboard' && typeof window.renderDashboard === 'function') {
      window.renderDashboard();
    } else if (page === 'transactions' && typeof window.renderTransactions === 'function') {
      window.renderTransactions();
    } else if (page === 'income' && typeof window.renderIncome === 'function') {
      window.renderIncome();
    } else if (page === 'expenses' && typeof window.renderExpenses === 'function') {
      window.renderExpenses();
    } else if (page === 'budget' && typeof window.renderBudget === 'function') {
      window.renderBudget();
    } else if (page === 'savings' && typeof window.renderSavings === 'function') {
      window.renderSavings();
    } else if (page === 'reports' && typeof window.renderReports === 'function') {
      window.renderReports();
    } else if (page === 'settings' && typeof window.initSettingsView === 'function') {
      window.initSettingsView();
    }
  } catch (err) {
    console.warn('View refresh note:', err);
  }
}

window.refreshActiveView = refreshActiveView;

// Form Validation Helpers
function clearTxValidationState() {
  const errorEl = document.getElementById('txFormError');
  const submitBtn = document.getElementById('txSaveBtn') || document.querySelector('#txModal button[onclick*="saveTransaction"]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    errorEl.classList.remove('flex');
  }
  if (submitBtn && !isSubmittingTx) {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-400', 'hover:bg-slate-400');
    submitBtn.classList.add('bg-primary-600', 'hover:bg-primary-700');
  }
}

function setTxValidationError(message) {
  const errorEl = document.getElementById('txFormError');
  const submitBtn = document.getElementById('txSaveBtn') || document.querySelector('#txModal button[onclick*="saveTransaction"]');

  if (errorEl) {
    errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${message || ''}`;
    errorEl.classList.toggle('hidden', !message);
    errorEl.classList.toggle('flex', !!message);
  }

  if (submitBtn) {
    submitBtn.disabled = !!message || isSubmittingTx;
    submitBtn.classList.toggle('opacity-50', !!message || isSubmittingTx);
    submitBtn.classList.toggle('cursor-not-allowed', !!message || isSubmittingTx);
    submitBtn.classList.toggle('bg-slate-400', !!message || isSubmittingTx);
    submitBtn.classList.toggle('hover:bg-slate-400', !!message || isSubmittingTx);
    submitBtn.classList.toggle('bg-primary-600', !message && !isSubmittingTx);
    submitBtn.classList.toggle('hover:bg-primary-700', !message && !isSubmittingTx);
  }
}

async function validateExpenseInput() {
  const type = document.getElementById('txType')?.value || 'income';
  const amount = parseFloat(document.getElementById('txAmount')?.value || '0');

  if (type !== 'expense' || !amount || amount <= 0) {
    clearTxValidationState();
    return false;
  }

  const availableBalance = AppState.getAvailableBalance();
  if (availableBalance <= 0 || amount >= availableBalance) {
    setTxValidationError('Insufficient funds');
    return true;
  }

  clearTxValidationState();
  return false;
}

export const EXPENSE_CATEGORIES = [
  'Food/groceries',
  'Bills',
  'Transport',
  'Education',
  'Shopping',
  'Skincare',
  'Health',
  'Entertainment'
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Gift',
  'Investment',
  'Others'
];

export const DEFAULT_CATEGORY_CLASSIFICATION = {
  'Food/groceries': 'Essential',
  'Food': 'Essential',
  'Bills': 'Essential',
  'Transport': 'Essential',
  'Health': 'Essential',
  'Education': 'Growth',
  'Investment': 'Growth',
  'Savings': 'Growth',
  'Shopping': 'Optional',
  'Skincare': 'Optional',
  'Entertainment': 'Optional',
  'Others': 'Optional'
};

export function selectTxClassification(val) {
  const hiddenInput = document.getElementById('txClassification');
  if (hiddenInput) hiddenInput.value = val || '';

  const buttons = document.querySelectorAll('#txClassificationGroup .tx-class-btn');
  buttons.forEach(btn => {
    const btnVal = btn.getAttribute('data-val');
    if (btnVal === val) {
      if (val === 'Essential') {
        btn.className = 'tx-class-btn py-2 px-2.5 rounded-xl border-2 border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all scale-[1.02]';
      } else if (val === 'Growth') {
        btn.className = 'tx-class-btn py-2 px-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all scale-[1.02]';
      } else if (val === 'Optional') {
        btn.className = 'tx-class-btn py-2 px-2.5 rounded-xl border-2 border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all scale-[1.02]';
      }
    } else {
      btn.className = 'tx-class-btn py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all opacity-80';
    }
  });
}
window.selectTxClassification = selectTxClassification;

export function updateTxCategoryOptions(type = 'income', selectedCategory = null) {
  const catSelect = document.getElementById('txCategory');
  const classContainer = document.getElementById('txClassificationContainer');
  const isIncome = (type === 'income');
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (catSelect) {
    catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selectedCategory && categories.includes(selectedCategory)) {
      catSelect.value = selectedCategory;
    } else {
      catSelect.value = categories[0];
    }
  }

  if (classContainer) {
    if (isIncome) {
      classContainer.classList.add('hidden');
      selectTxClassification('');
    } else {
      classContainer.classList.remove('hidden');
      const cat = catSelect?.value || 'Food/groceries';
      const defaultClass = DEFAULT_CATEGORY_CLASSIFICATION[cat] || 'Essential';
      const currentClass = document.getElementById('txClassification')?.value;
      if (!currentClass) {
        selectTxClassification(defaultClass);
      }
    }
  }
}

window.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
window.INCOME_CATEGORIES = INCOME_CATEGORIES;
window.updateTxCategoryOptions = updateTxCategoryOptions;

function resetTransactionForm(defaultType = 'income') {
  const txType = document.getElementById('txType');
  const txAmount = document.getElementById('txAmount');
  const txDesc = document.getElementById('txDesc');
  const txDate = document.getElementById('txDate');
  const txNote = document.getElementById('txNote');

  if (txType) txType.value = defaultType;
  updateTxCategoryOptions(defaultType);
  if (defaultType === 'expense') {
    const cat = document.getElementById('txCategory')?.value || 'Food/groceries';
    selectTxClassification(DEFAULT_CATEGORY_CLASSIFICATION[cat] || 'Essential');
  } else {
    selectTxClassification('');
  }
  if (txAmount) txAmount.value = '';
  if (txDesc) txDesc.value = '';
  if (txDate) txDate.value = todayDateString();
  if (txNote) txNote.value = '';
  clearTxValidationState();
}

window.resetTransactionForm = resetTransactionForm;

// Category change listener to auto-suggest classification when category shifts
document.addEventListener('DOMContentLoaded', () => {
  const catSelect = document.getElementById('txCategory');
  const txType = document.getElementById('txType');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      if (txType?.value === 'expense') {
        const cat = catSelect.value;
        const suggested = DEFAULT_CATEGORY_CLASSIFICATION[cat] || 'Essential';
        selectTxClassification(suggested);
      }
    });
  }
  if (txType) {
    txType.addEventListener('change', () => {
      updateTxCategoryOptions(txType.value);
    });
  }
});

window.resetBudgetForm = function() {
  const category = document.getElementById('budgetCategory');
  const limit = document.getElementById('budgetLimit');
  if (category) category.value = 'Food/groceries';
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

// -------------------------------------------------------------
// Protected Single-Click Action Handlers with Button Disablement
// -------------------------------------------------------------

window.saveTransaction = async function() {
  if (isSubmittingTx) return;
  isSubmittingTx = true;

  const submitBtn = document.getElementById('txSaveBtn') || document.querySelector('#txModal button[onclick*="saveTransaction"]');
  const origContent = submitBtn ? submitBtn.innerHTML : 'Save';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Saving...';
  }

  try {
    const type = document.getElementById('txType')?.value || 'expense';
    const amount = parseFloat(document.getElementById('txAmount')?.value);
    const desc = document.getElementById('txDesc')?.value?.trim() || '';
    const category = document.getElementById('txCategory')?.value || (type === 'income' ? 'Salary' : 'Food/groceries');
    const classification = type === 'expense' ? (document.getElementById('txClassification')?.value || '') : null;
    const date = document.getElementById('txDate')?.value || todayDateString();
    const note = document.getElementById('txNote')?.value?.trim() || '';

    if (!amount || amount <= 0) {
      SmartAlerts.show({
        title: 'Invalid Amount',
        message: 'Please enter a valid amount greater than 0.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }
    if (!desc) {
      SmartAlerts.show({
        title: 'Missing Description',
        message: 'Please enter a description for this transaction.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }
    if (type === 'expense' && !classification) {
      SmartAlerts.show({
        title: 'Classification Required',
        message: 'Please choose whether this expense is <strong>Essential</strong>, <strong>Growth</strong>, or <strong>Optional</strong>.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }

    await AppState.addTransaction({ type, amount, desc, category, classification, date, note });
    closeModal('txModal');
    resetTransactionForm();
  } catch (error) {
    console.warn('saveTransaction error:', error);
  } finally {
    isSubmittingTx = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      submitBtn.innerHTML = origContent;
    }
  }
};

window.deleteTx = function(id) {
  openConfirm('Delete this transaction? You will have 5 seconds to undo.', 'Delete Transaction', 'Delete', async () => {
    await AppState.deleteTransaction(id);
  });
};

window.saveBudget = async function() {
  if (isSubmittingBudget) return;
  isSubmittingBudget = true;

  const submitBtn = document.getElementById('budgetSaveBtn') || document.querySelector('#budgetModal button[onclick*="saveBudget"]');
  const origContent = submitBtn ? submitBtn.innerHTML : 'Save Budget';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Saving...';
  }

  try {
    const category = document.getElementById('budgetCategory')?.value || 'Food/groceries';
    const limit = parseFloat(document.getElementById('budgetLimit')?.value);
    if (!limit || limit <= 0) {
      SmartAlerts.show({
        title: 'Invalid Limit',
        message: 'Please enter a valid monthly budget limit.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }

    await AppState.setBudget({ category, limit });
    closeModal('budgetModal');
    window.resetBudgetForm();
  } catch (err) {
    console.warn('saveBudget error:', err);
  } finally {
    isSubmittingBudget = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      submitBtn.innerHTML = origContent;
    }
  }
};

window.deleteBudgetItem = function(id) {
  openConfirm('Delete this budget plan? Spending in this category will no longer be limited.', 'Delete Budget', 'Delete', async () => {
    await AppState.deleteBudget(id);
  });
};

window.saveSavingsGoal = async function() {
  if (isSubmittingGoal) return;
  isSubmittingGoal = true;

  const submitBtn = document.getElementById('savingsSaveBtn') || document.querySelector('#savingsModal button[onclick*="saveSavingsGoal"]');
  const origContent = submitBtn ? submitBtn.innerHTML : 'Save Goal';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Saving Goal...';
  }

  try {
    const name = document.getElementById('goalName')?.value.trim();
    const target = parseFloat(document.getElementById('goalTarget')?.value);
    const saved = parseFloat(document.getElementById('goalSaved')?.value) || 0;
    const desc = document.getElementById('goalDesc')?.value.trim();

    if (!name) {
      SmartAlerts.show({
        title: 'Missing Name',
        message: 'Please provide a name for your savings goal.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }
    if (!target || target <= 0) {
      SmartAlerts.show({
        title: 'Invalid Target',
        message: 'Please enter a valid target amount.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }

    await AppState.addGoal({ name, target, saved, desc });
    closeModal('savingsModal');
    window.resetSavingsGoalForm();
  } catch (err) {
    console.warn('saveSavingsGoal error:', err);
  } finally {
    isSubmittingGoal = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      submitBtn.innerHTML = origContent;
    }
  }
};

let currentSelectedGoalId = null;
window.addFunds = function(id) {
  currentSelectedGoalId = id;
  const amountEl = document.getElementById('addFundsAmount');
  const noteEl = document.getElementById('addFundsNote');
  if (amountEl) amountEl.value = '';
  if (noteEl) noteEl.value = '';
  openModal('addFundsModal');
};

window.saveFundsToGoal = async function() {
  if (isSubmittingFunds) return;
  isSubmittingFunds = true;

  const submitBtn = document.getElementById('addFundsSaveBtn') || document.querySelector('#addFundsModal button[onclick*="saveFundsToGoal"]');
  const origContent = submitBtn ? submitBtn.innerHTML : 'Add Funds';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Adding...';
  }

  try {
    const amount = parseFloat(document.getElementById('addFundsAmount')?.value);
    const note = document.getElementById('addFundsNote')?.value.trim() || '';

    if (!amount || amount <= 0) {
      SmartAlerts.show({
        title: 'Invalid Amount',
        message: 'Please enter a valid amount to transfer to this goal.',
        type: 'warning',
        icon: 'fa-circle-exclamation',
        sound: 'warning'
      });
      return;
    }

    if (!currentSelectedGoalId) return;

    await AppState.addFundsToGoal(currentSelectedGoalId, amount, note);
    closeModal('addFundsModal');
    window.resetAddFundsForm();
  } catch (err) {
    console.warn('saveFundsToGoal error:', err);
  } finally {
    isSubmittingFunds = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      submitBtn.innerHTML = origContent;
    }
  }
};

window.deleteGoalItem = function(id) {
  openConfirm('Delete this savings goal? This cannot be undone.', 'Delete Goal', 'Delete', async () => {
    await AppState.deleteGoal(id);
  });
};

window.saveProfile = async function() {
  if (isSubmittingProfile) return;
  isSubmittingProfile = true;

  const submitBtn = document.getElementById('profileSaveBtn') || document.querySelector('button[onclick*="saveProfile"]');
  const origContent = submitBtn ? submitBtn.innerHTML : 'Save Profile';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Saving...';
  }

  try {
    const data = {
      name: document.getElementById('profileName')?.value.trim() || 'User',
      email: document.getElementById('profileEmail')?.value.trim(),
      phone: document.getElementById('profilePhone')?.value.trim(),
      currency: document.getElementById('profileCurrency')?.value || '₦'
    };

    await AppState.saveProfile(data);
    syncHeaderProfile(data);
    const avatar = document.getElementById('profileAvatarBig');
    if (avatar) avatar.textContent = getInitialFromName(data.name);
  } catch (err) {
    console.warn('saveProfile error:', err);
  } finally {
    isSubmittingProfile = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      submitBtn.innerHTML = origContent;
    }
  }
};

window.toggleDarkMode = async function() {
  const isDark = document.getElementById('darkModeToggle')?.checked;
  setStoredTheme(isDark);
  await AppState.saveSettings({ darkMode: isDark });
  SmartAlerts.notifyThemeToggled(isDark);
};

window.toggleSoundEffects = function() {
  const isSound = document.getElementById('soundToggle')?.checked;
  SmartAlerts.setSoundEnabled(isSound);
  SmartAlerts.show({
    title: isSound ? 'Sound Effects Enabled' : 'Sound Effects Muted',
    message: isSound ? 'Subtle audio cues are active for smart alerts.' : 'Audio cues are now muted.',
    type: 'info',
    icon: isSound ? 'fa-volume-high' : 'fa-volume-xmark',
    badge: '<i class="fa-solid fa-volume-high mr-1"></i> Audio',
    sound: isSound ? 'success' : false,
    record: false
  });
};

// Open/Close Notification Drawer
window.openNotificationDrawer = function() {
  SmartAlerts.openNotificationDrawer();
};

// Input event listeners for real-time validation
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'txAmount') {
    const type = document.getElementById('txType')?.value || 'income';
    if (type === 'expense') {
      validateExpenseInput();
    } else {
      clearTxValidationState();
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'txType') {
    const type = document.getElementById('txType')?.value || 'income';
    updateTxCategoryOptions(type);
    if (type === 'expense') {
      validateExpenseInput();
    } else {
      clearTxValidationState();
    }
  }
});

// Register PWA service worker from root of public domain
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
