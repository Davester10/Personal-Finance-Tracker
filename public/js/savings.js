// js/savings.js
import { initAuth } from "./auth.js";
import { AppState } from "./app-core.js";
import { formatCurrency } from "./firebase.js";

initAuth();

let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  if (!monthEl || !yearEl) return;

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthEl.innerHTML = '';
  months.forEach((m, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = m;
    if (i === filterMonth) option.selected = true;
    monthEl.appendChild(option);
  });

  yearEl.innerHTML = '';
  const cy = new Date().getFullYear();
  for (let y = cy - 3; y <= cy + 1; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === filterYear) option.selected = true;
    yearEl.appendChild(option);
  }

  monthEl.onchange = () => {
    filterMonth = Number(monthEl.value);
    window.renderSavings();
  };

  yearEl.onchange = () => {
    filterYear = Number(yearEl.value);
    window.renderSavings();
  };
}

window.renderSavings = function() {
  const sym = AppState.getCurrency();
  const goals = AppState.goals || [];
  const list = document.getElementById('savingsList');
  if (!list) return;

  if (!goals.length) {
    list.innerHTML = '<div class="text-center py-16 text-slate-400 text-sm"><div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xl"><i class="fa-solid fa-piggy-bank"></i></div>No savings goals yet. Create one with "+ New Goal" above!</div>';
    return;
  }

  list.innerHTML = goals.map(g => {
    const saved = Number(g.saved) || 0;
    const target = Number(g.target) || 0;
    const pct = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;
    const isCompleted = pct >= 100;

    return `
      <div class="flex items-center gap-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all flex-wrap">
        <div class="w-12 h-12 rounded-2xl ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'} flex items-center justify-center text-xl shrink-0">
          <i class="fa-solid ${isCompleted ? 'fa-trophy' : 'fa-piggy-bank'}"></i>
        </div>
        <div class="flex-1 min-w-[180px]">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-slate-900 dark:text-white">${g.name}</span>
            ${isCompleted ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">Completed!</span>' : ''}
          </div>
          <div class="text-xs text-slate-400">${g.desc || 'Savings goal'}</div>
          <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-2.5 overflow-hidden">
            <div class="h-full ${isCompleted ? 'bg-emerald-500' : 'bg-primary-600'} rounded-full transition-all duration-500" style="width:${pct}%"></div>
          </div>
          <div class="flex items-center justify-between text-xs font-bold ${isCompleted ? 'text-emerald-600' : 'text-primary-600'} mt-1">
            <span>${pct}% saved</span>
            <span class="text-slate-400 font-normal">${sym}${Math.max(0, target - saved).toLocaleString('en-NG')} remaining</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-lg font-extrabold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary-600 dark:text-primary-400'}">${sym}${saved.toLocaleString('en-NG')}</div>
          <div class="text-xs text-slate-400">target: ${sym}${target.toLocaleString('en-NG')}</div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button onclick="window.addFunds('${g.id}')" class="px-3.5 py-2 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 text-xs font-bold hover:bg-primary-600 hover:text-white transition-colors shadow-sm">+ Add Funds</button>
          <button onclick="window.deleteGoalItem('${g.id}')" class="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors shadow-sm" title="Delete goal">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`;
  }).join('');
};

setupMonthYearFilter();
if (AppState.initialized) {
  window.renderSavings();
} else {
  AppState.on('initialized', () => window.renderSavings());
}
