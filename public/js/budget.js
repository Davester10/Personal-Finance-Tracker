// js/budget.js
import { initAuth } from "./auth.js";
import { AppState } from "./app-core.js";
import { formatCurrency } from "./firebase.js";

initAuth();

let filterMonth = (() => {
  const s = sessionStorage.getItem('mf_filter_month');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getMonth();
})();
let filterYear = (() => {
  const s = sessionStorage.getItem('mf_filter_year');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getFullYear();
})();

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  if (!monthEl || !yearEl) return;

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
    filterMonth = parseInt(monthEl.value);
    sessionStorage.setItem('mf_filter_month', filterMonth);
    window.renderBudget();
  };
  yearEl.onchange = () => {
    filterYear = parseInt(yearEl.value);
    sessionStorage.setItem('mf_filter_year', filterYear);
    window.renderBudget();
  };
}

function getExpenses() {
  const txs = AppState.transactions || [];
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear && tx.type === 'expense';
  });
}

window.renderBudget = function() {
  const expenses = getExpenses();
  const budgets = AppState.budgets || [];
  const sym = AppState.getCurrency();
  const list = document.getElementById('budgetList');
  if (!list) return;

  if (!budgets.length) {
    list.innerHTML = '<div class="text-center py-16 text-slate-400 text-sm col-span-full"><div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xl"><i class="fa-solid fa-bullseye"></i></div>No budgets set yet. Click "+ Set Budget" above to track category spending!</div>';
    return;
  }

  list.innerHTML = budgets.map(b => {
    const spent = expenses.filter(t => t.category === b.category).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const pct = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0;
    const over = spent > b.limit;
    const barColor = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-400' : 'bg-emerald-500';
    const statusColor = pct >= 100 ? 'text-red-600 dark:text-red-400' : pct >= 75 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    const status = over
      ? `🚨 Over budget by ${sym}${(spent - b.limit).toLocaleString('en-NG')}!`
      : `${100 - pct}% of budget remaining (${sym}${Math.max(0, b.limit - spent).toLocaleString('en-NG')} left)`;

    return `
      <div class="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span class="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs">
              <i class="fa-solid fa-tag"></i>
            </span>
            ${b.category}
          </h4>
          <button onclick="window.deleteBudgetItem('${b.id}')" class="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors" title="Delete budget">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span>Spent: <strong class="text-slate-900 dark:text-white">${sym}${spent.toLocaleString('en-NG')}</strong></span>
          <span>Limit: <strong class="text-slate-900 dark:text-white">${sym}${b.limit.toLocaleString('en-NG')}</strong></span>
        </div>
        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width:${pct}%"></div>
        </div>
        <div class="flex items-center justify-between text-xs font-bold ${statusColor}">
          <span>${status}</span>
          <span>${pct}%</span>
        </div>
      </div>`;
  }).join('');
};

setupMonthYearFilter();
if (AppState.initialized) {
  window.renderBudget();
} else {
  AppState.on('initialized', () => window.renderBudget());
}
