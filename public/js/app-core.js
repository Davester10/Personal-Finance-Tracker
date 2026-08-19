// js/app-core.js - Reactive State Store, Clean Page Navigation & Smart Actions
import { getCurrentUser } from "./auth.js";
import {
  getProfile, saveProfile as fsSaveProfile,
  getSettings, saveSettings as fsSaveSettings,
  getTransactions, addTransaction as fsAddTransaction,
  updateTransaction as fsUpdateTransaction, deleteTransaction as fsDeleteTransaction,
  getBudgets, setBudget as fsSetBudget, deleteBudget as fsDeleteBudget,
  getGoals, addGoal as fsAddGoal, updateGoal as fsUpdateGoal, deleteGoal as fsDeleteGoal,
  todayDateString, formatCurrency, formatDate
} from "./firebase.js";
import { SmartAlerts } from "./smart-alerts.js";

class ReactiveStateStore {
  constructor() {
    this.uid = null;
    this.initialized = false;
    this.profile = { name: "User", email: "", phone: "", currency: "₦" };
    this.settings = { darkMode: false, soundEnabled: true };
    this.transactions = [];
    this.budgets = [];
    this.goals = [];
    this.listeners = new Map();
    this.lastDeletedTransaction = null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.warn(`Listener error on ${event}:`, e); }
      });
    }
    if (event !== 'state:changed') {
      this.emit('state:changed', { event, data });
    }
  }

  async init(uid) {
    this.uid = uid || getCurrentUser()?.uid || 'demo-user';
    try {
      const [profileData, settingsData, txsData, budgetsData, goalsData] = await Promise.all([
        getProfile(this.uid),
        getSettings(this.uid),
        getTransactions(this.uid),
        getBudgets(this.uid),
        getGoals(this.uid)
      ]);

      this.profile = profileData || this.profile;
      this.settings = settingsData || this.settings;
      this.transactions = txsData || [];
      this.budgets = budgetsData || [];
      this.goals = goalsData || [];
      this.initialized = true;

      this.emit('initialized', { state: this });
    } catch (err) {
      console.warn('AppState init fallback:', err);
      this.initialized = true;
      this.emit('initialized', { state: this });
    }
    return this;
  }

  getCurrency() {
    return this.profile?.currency || '₦';
  }

  getAvailableBalance() {
    return this.transactions.reduce((bal, tx) => {
      const amt = Number(tx.amount) || 0;
      return bal + (tx.type === 'income' ? amt : tx.type === 'expense' ? -amt : 0);
    }, 0);
  }

  getCategoryMonthlyExpense(category, month = new Date().getMonth(), year = new Date().getFullYear()) {
    return this.transactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;
        if (category && tx.category !== category) return false;
        const d = new Date(tx.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }

  getMonthlyIncome(month = new Date().getMonth(), year = new Date().getFullYear()) {
    return this.transactions
      .filter(tx => {
        if (tx.type !== 'income') return false;
        const d = new Date(tx.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }

  // --- ACTIONS WITH OPTIMISTIC UPDATES & SMART ALERTS ---

  async addTransaction(txData) {
    const amount = Number(txData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    const currentBalance = this.getAvailableBalance();
    if (txData.type === 'expense' && (currentBalance <= 0 || amount >= currentBalance)) {
      const err = new Error('Insufficient funds');
      err.code = 'INSUFFICIENT_FUNDS';
      SmartAlerts.show({
        title: 'Insufficient Funds',
        message: `Cannot record expense of <strong>${this.getCurrency()}${amount.toLocaleString('en-NG')}</strong>. Available balance is ${this.getCurrency()}${Math.max(0, currentBalance).toLocaleString('en-NG')}.`,
        type: 'over_budget',
        icon: 'fa-triangle-exclamation',
        badge: '<i class="fa-solid fa-triangle-exclamation mr-1"></i> Declined',
        sound: 'warning'
      });
      throw err;
    }

    const tempId = 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newTx = {
      id: tempId,
      ...txData,
      amount,
      createdAt: new Date().toISOString(),
      userId: this.uid
    };

    // Optimistic Update
    this.transactions = [newTx, ...this.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const newBalance = this.getAvailableBalance();
    const currency = this.getCurrency();

    // Contextual Smart Alert
    if (txData.type === 'income') {
      SmartAlerts.notifyIncomeAdded({
        amount,
        desc: txData.desc,
        category: txData.category,
        newBalance,
        currency
      });
    } else {
      const budgetObj = this.budgets.find(b => b.category === txData.category);
      const spentCurrent = this.getCategoryMonthlyExpense(txData.category);
      const monthlyInc = this.getMonthlyIncome();

      SmartAlerts.notifyExpenseAdded({
        amount,
        desc: txData.desc,
        category: txData.category,
        spentInCategory: spentCurrent,
        budgetLimit: budgetObj ? budgetObj.limit : null,
        newBalance,
        monthlyIncome: monthlyInc,
        currency
      });
    }

    this.emit('transactions:changed', this.transactions);

    // Background Firestore Sync
    try {
      const docRef = await fsAddTransaction(this.uid, txData);
      if (docRef?.id) {
        newTx.id = docRef.id;
      }
    } catch (e) {
      if (e?.code === 'INSUFFICIENT_FUNDS') throw e;
    }
    return newTx;
  }

  async deleteTransaction(id) {
    const tx = this.transactions.find(t => t.id === id);
    if (!tx) return;

    this.lastDeletedTransaction = { ...tx };
    const currency = this.getCurrency();

    // Optimistic Remove
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.emit('transactions:changed', this.transactions);

    // Smart Alert with 5-second Undo
    SmartAlerts.notifyTransactionDeleted({
      transaction: tx,
      currency,
      onUndo: async () => {
        await this.restoreTransaction(tx);
      }
    });

    // Background Delete
    try {
      await fsDeleteTransaction(this.uid, id);
    } catch (_) {}
  }

  async restoreTransaction(tx) {
    if (!tx) return;
    this.transactions = [tx, ...this.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    this.emit('transactions:changed', this.transactions);

    SmartAlerts.notifyTransactionRestored({
      transaction: tx,
      currency: this.getCurrency()
    });

    try {
      await fsAddTransaction(this.uid, {
        type: tx.type,
        amount: tx.amount,
        desc: tx.desc,
        category: tx.category,
        date: tx.date,
        note: tx.note || ''
      });
    } catch (_) {}
  }

  async setBudget(budgetData) {
    const limit = Number(budgetData.limit);
    const category = budgetData.category;
    const existing = this.budgets.find(b => b.category === category);
    const spentCurrent = this.getCategoryMonthlyExpense(category);

    if (existing) {
      existing.limit = limit;
    } else {
      this.budgets.push({
        id: 'bg_' + Date.now().toString(36),
        category,
        limit
      });
    }

    this.emit('budgets:changed', this.budgets);

    SmartAlerts.notifyBudgetSet({
      category,
      limit,
      spentCurrent,
      currency: this.getCurrency()
    });

    try {
      await fsSetBudget(this.uid, { category, limit });
    } catch (_) {}
  }

  async deleteBudget(id) {
    const budget = this.budgets.find(b => b.id === id);
    this.budgets = this.budgets.filter(b => b.id !== id);
    this.emit('budgets:changed', this.budgets);

    if (budget) {
      SmartAlerts.notifyBudgetDeleted({ category: budget.category });
    }

    try {
      await fsDeleteBudget(this.uid, id);
    } catch (_) {}
  }

  async addGoal(goalData) {
    const target = Number(goalData.target);
    const saved = Number(goalData.saved) || 0;
    const newGoal = {
      id: 'gl_' + Date.now().toString(36),
      name: goalData.name,
      target,
      saved,
      desc: goalData.desc || ''
    };

    if (saved > 0) {
      const currentBalance = this.getAvailableBalance();
      if (currentBalance <= 0 || saved >= currentBalance) {
        SmartAlerts.show({
          title: 'Insufficient Balance',
          message: `Cannot initialize goal with ${this.getCurrency()}${saved.toLocaleString('en-NG')}. Available balance is ${this.getCurrency()}${Math.max(0, currentBalance).toLocaleString('en-NG')}.`,
          type: 'over_budget',
          icon: 'fa-triangle-exclamation',
          sound: 'warning'
        });
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Add expense for initial savings fund
      await this.addTransaction({
        type: 'expense',
        amount: saved,
        desc: `Initial savings for ${goalData.name}`,
        category: 'Savings',
        date: todayDateString(),
        note: 'Initial savings goal allocation'
      });
    }

    this.goals.push(newGoal);
    this.emit('goals:changed', this.goals);

    SmartAlerts.notifyGoalCreated({
      name: goalData.name,
      target,
      saved,
      currency: this.getCurrency()
    });

    try {
      await fsAddGoal(this.uid, newGoal);
    } catch (_) {}
    return newGoal;
  }

  async addFundsToGoal(goalId, amount, note = '') {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) return;

    const currentBalance = this.getAvailableBalance();
    if (currentBalance <= 0 || numAmt >= currentBalance) {
      SmartAlerts.show({
        title: 'Insufficient Balance',
        message: `Cannot transfer ${this.getCurrency()}${numAmt.toLocaleString('en-NG')}. Available balance is ${this.getCurrency()}${Math.max(0, currentBalance).toLocaleString('en-NG')}.`,
        type: 'over_budget',
        icon: 'fa-triangle-exclamation',
        sound: 'warning'
      });
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // Add transaction
    await this.addTransaction({
      type: 'expense',
      amount: numAmt,
      desc: `Savings transfer to ${goal.name}`,
      category: 'Savings',
      date: todayDateString(),
      note: note || 'Savings goal contribution'
    });

    const prevSaved = goal.saved || 0;
    goal.saved = prevSaved + numAmt;
    this.emit('goals:changed', this.goals);

    SmartAlerts.notifyFundsAddedToGoal({
      goalName: goal.name,
      addedAmount: numAmt,
      newSaved: goal.saved,
      target: goal.target,
      currency: this.getCurrency()
    });

    try {
      await fsUpdateGoal(this.uid, goalId, { saved: goal.saved });
    } catch (_) {}
  }

  async deleteGoal(id) {
    const goal = this.goals.find(g => g.id === id);
    this.goals = this.goals.filter(g => g.id !== id);
    this.emit('goals:changed', this.goals);

    if (goal) {
      SmartAlerts.notifyGoalDeleted({ name: goal.name });
    }

    try {
      await fsDeleteGoal(this.uid, id);
    } catch (_) {}
  }

  async saveProfile(data) {
    this.profile = { ...this.profile, ...data };
    this.emit('profile:changed', this.profile);

    SmartAlerts.notifyProfileSaved({
      name: this.profile.name,
      currency: this.profile.currency
    });

    try {
      await fsSaveProfile(this.uid, data);
    } catch (_) {}
  }

  async saveSettings(data) {
    this.settings = { ...this.settings, ...data };
    this.emit('settings:changed', this.settings);
    try {
      await fsSaveSettings(this.uid, data);
    } catch (_) {}
  }
}

export const AppState = new ReactiveStateStore();
if (typeof window !== 'undefined') {
  window.AppState = AppState;
}

// -------------------------------------------------------------
// CLEAN APPLICATION ROUTER (Standard Full Page Reloads)
// -------------------------------------------------------------

export const Router = {
  navigate(url) {
    if (typeof window !== 'undefined' && url) {
      window.location.href = url;
    }
  }
};

if (typeof window !== 'undefined') {
  window.Router = Router;
}
