// js/expenses.js
import { initAuth } from "./auth.js";
import { AppState } from "./app-core.js";
import { formatCurrency, formatDate } from "./firebase.js";

initAuth();

let filterMonth = (() => {
  const s = sessionStorage.getItem('mf_filter_month');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getMonth();
})();
let filterYear = (() => {
  const s = sessionStorage.getItem('mf_filter_year');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getFullYear();
})();
const cats = ['Food/groceries', 'Bills', 'Transport', 'Education', 'Shopping', 'Skincare', 'Health', 'Entertainment'];

function populateFilters() {
  const el = document.getElementById('expenseCatFilter');
  if (!el) return;
  el.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

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
    window.renderExpenses();
  };
  yearEl.onchange = () => {
    filterYear = parseInt(yearEl.value);
    sessionStorage.setItem('mf_filter_year', filterYear);
    window.renderExpenses();
  };

  const searchEl = document.getElementById('expenseSearch');
  const classEl = document.getElementById('expenseClassFilter');
  const catEl = document.getElementById('expenseCatFilter');
  if (searchEl) searchEl.oninput = () => window.renderExpenses();
  if (classEl) classEl.onchange = () => window.renderExpenses();
  if (catEl) catEl.onchange = () => window.renderExpenses();
}

function getFiltered() {
  const txs = AppState.transactions || [];
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear && tx.type === 'expense';
  });
}

window.renderExpenses = function() {
  let items = getFiltered();
  const search = (document.getElementById('expenseSearch')?.value || '').toLowerCase();
  const classFilter = document.getElementById('expenseClassFilter')?.value || '';
  const cat = document.getElementById('expenseCatFilter')?.value || '';

  if (search) {
    items = items.filter(t => (t.desc || '').toLowerCase().includes(search) || (t.category || '').toLowerCase().includes(search));
  }
  if (classFilter) {
    items = items.filter(t => AppState.getTransactionClassification(t) === classFilter);
  }
  if (cat) items = items.filter(t => t.category === cat);

  const total = getFiltered().reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const sym = AppState.getCurrency();

  const totalEl = document.getElementById('expensePageTotal');
  const countEl = document.getElementById('expensePageCount');
  if (totalEl) totalEl.textContent = formatCurrency(total, sym);
  if (countEl) countEl.textContent = getFiltered().length;

  const list = document.getElementById('expenseList');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<div class="text-center py-16 text-slate-400 text-sm"><div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xl"><i class="fa-solid fa-receipt"></i></div>No expense transactions found for this month.</div>';
    return;
  }

  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(tx => txItemHTML(tx, sym)).join('');
};

function txItemHTML(tx, sym) {
  const icons = {
    'Food/groceries':'fa-utensils', Food:'fa-utensils', Transport:'fa-car', Shopping:'fa-bag-shopping', Bills:'fa-bolt',
    Education:'fa-book', Skincare:'fa-spa', Health:'fa-heart', Entertainment:'fa-film',
    Salary:'fa-briefcase', Business:'fa-building', Investment:'fa-chart-line',
    Gift:'fa-gift', Others:'fa-box', Savings:'fa-piggy-bank'
  };

  const cls = AppState.getTransactionClassification(tx);
  let classBadge = '';
  if (cls === 'Growth') {
    classBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"><i class="fa-solid fa-arrow-trend-up text-[9px]"></i> Growth</span>`;
  } else if (cls === 'Optional') {
    classBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"><i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i> Optional</span>`;
  } else {
    classBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"><i class="fa-solid fa-shield-halved text-[9px]"></i> Essential</span>`;
  }

  return `
    <div class="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all">
      <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm shrink-0">
        <i class="fa-solid fa-arrow-down"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-slate-900 dark:text-white truncate">${tx.desc}</span>
          ${classBadge}
        </div>
        <div class="text-xs text-slate-400 mt-0.5">Expense • <i class="fa-solid ${icons[tx.category]||'fa-box'} text-[10px]"></i> ${tx.category}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs text-slate-400">${formatDate(tx.date)}</div>
        <div class="text-sm font-extrabold text-rose-600 dark:text-rose-400">-${formatCurrency(tx.amount, sym)}</div>
      </div>
      <button onclick="window.deleteTx('${tx.id}')" class="shrink-0 w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors shadow-sm" title="Delete expense">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
}

populateFilters();
setupMonthYearFilter();
if (AppState.initialized) {
  window.renderExpenses();
} else {
  AppState.on('initialized', () => window.renderExpenses());
}
