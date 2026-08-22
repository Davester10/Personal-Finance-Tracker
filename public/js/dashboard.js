// js/dashboard.js
import { initAuth, getCurrentUser } from "./auth.js";
import { AppState } from "./app-core.js";
import { formatCurrency, formatDate, todayDateString } from "./firebase.js";

initAuth();

let filterMonth = (() => {
  const s = sessionStorage.getItem('mf_filter_month');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getMonth();
})();
let filterYear = (() => {
  const s = sessionStorage.getItem('mf_filter_year');
  return (s !== null && !isNaN(parseInt(s))) ? parseInt(s) : new Date().getFullYear();
})();
let donutChart = null;

const CATEGORY_COLORS = {
  'Food/groceries': '#3B82F6', Food: '#3B82F6', Bills: '#8B5CF6', Transport: '#10B981',
  Education: '#06B6D4', Shopping: '#F59E0B', Skincare: '#EC4899', Health: '#EF4444',
  Entertainment: '#F97316', Salary: '#22C55E', Gift: '#A855F7', Investment: '#14B8A6',
  Others: '#9CA3AF', Savings: '#10B981', Business: '#6366F1'
};

const CATEGORY_ICONS = {
  'Food/groceries': 'fa-utensils', Food: 'fa-utensils', Bills: 'fa-bolt', Transport: 'fa-car',
  Education: 'fa-book', Shopping: 'fa-bag-shopping', Skincare: 'fa-spa', Health: 'fa-heart',
  Entertainment: 'fa-film', Salary: 'fa-briefcase', Gift: 'fa-gift', Investment: 'fa-chart-line',
  Others: 'fa-box', Savings: 'fa-piggy-bank', Business: 'fa-building'
};

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  if (!monthEl || !yearEl) return;

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthEl.innerHTML = '';
  months.forEach((m,i) => {
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
    window.renderDashboard();
  };
  yearEl.onchange = () => {
    filterYear = parseInt(yearEl.value);
    sessionStorage.setItem('mf_filter_year', filterYear);
    window.renderDashboard();
  };
}

function getFiltered() {
  const txs = AppState.transactions || [];
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });
}

function renderSmartInsightBanner(filtered, sym) {
  const bannerContainer = document.getElementById('dashSmartInsightBanner');
  if (!bannerContainer) return;

  const expenses = filtered.filter(t => t.type === 'expense');
  const budgets = AppState.budgets || [];
  const goals = AppState.goals || [];

  // Check for budget alerts
  let criticalAlert = null;
  let warningAlert = null;

  for (const b of budgets) {
    const spent = expenses.filter(t => t.category === b.category).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
    if (pct > 100 && !criticalAlert) {
      criticalAlert = {
        category: b.category,
        spent,
        limit: b.limit,
        over: spent - b.limit,
        pct
      };
    } else if (pct >= 80 && !warningAlert) {
      warningAlert = {
        category: b.category,
        spent,
        limit: b.limit,
        pct
      };
    }
  }

  // Check goal milestone
  const topGoal = goals.length ? goals.reduce((prev, curr) => (curr.saved / curr.target > prev.saved / prev.target) ? curr : prev, goals[0]) : null;
  const topGoalPct = topGoal && topGoal.target > 0 ? Math.round((topGoal.saved / topGoal.target) * 100) : 0;

  if (criticalAlert) {
    bannerContainer.className = 'mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-4 animate-fadeIn';
    bannerContainer.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-500/20">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm text-red-900 dark:text-red-300">Over-Budget Alert: ${criticalAlert.category}</div>
          <div class="text-xs text-red-700 dark:text-red-400 mt-0.5 truncate">Exceeded limit by <strong>${sym}${criticalAlert.over.toLocaleString('en-NG')}</strong> (${criticalAlert.pct}% used of ${sym}${criticalAlert.limit.toLocaleString('en-NG')}).</div>
        </div>
      </div>
      <a href="budget.html" class="shrink-0 px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm">Review Budget</a>
    `;
    bannerContainer.classList.remove('hidden');
  } else if (warningAlert) {
    bannerContainer.className = 'mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-4 animate-fadeIn';
    bannerContainer.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm text-amber-900 dark:text-amber-300">Approaching Budget Limit: ${warningAlert.category}</div>
          <div class="text-xs text-amber-700 dark:text-amber-400 mt-0.5 truncate">${warningAlert.pct}% of your monthly limit spent (${sym}${warningAlert.spent.toLocaleString('en-NG')} / ${sym}${warningAlert.limit.toLocaleString('en-NG')}).</div>
        </div>
      </div>
      <a href="budget.html" class="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm">Manage</a>
    `;
    bannerContainer.classList.remove('hidden');
  } else if (topGoal && topGoalPct >= 50) {
    bannerContainer.className = 'mb-6 p-4 rounded-2xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/60 flex items-center justify-between gap-4 animate-fadeIn';
    bannerContainer.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/20">
          <i class="fa-solid fa-trophy"></i>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm text-primary-900 dark:text-primary-300">Savings Pace: ${topGoal.name} is ${topGoalPct}% Funded!</div>
          <div class="text-xs text-primary-700 dark:text-primary-400 mt-0.5 truncate">${sym}${topGoal.saved.toLocaleString('en-NG')} saved toward your ${sym}${topGoal.target.toLocaleString('en-NG')} goal. Keep it up!</div>
        </div>
      </div>
      <a href="savings.html" class="shrink-0 px-3.5 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm">View Goals</a>
    `;
    bannerContainer.classList.remove('hidden');
  } else {
    bannerContainer.classList.add('hidden');
  }
}

window.renderDashboard = function() {
  const filtered = getFiltered();
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const balance = Math.max(0, totalIncome - totalExpense);
  const sym = AppState.getCurrency();
  const goals = AppState.goals || [];

  const incEl = document.getElementById('dashTotalIncome');
  const expEl = document.getElementById('dashTotalExpense');
  const balEl = document.getElementById('dashBalance');

  if (incEl) incEl.textContent = formatCurrency(totalIncome, sym);
  if (expEl) expEl.textContent = formatCurrency(totalExpense, sym);
  if (balEl) balEl.textContent = formatCurrency(balance, sym);

  // Smart Insight Banner
  renderSmartInsightBanner(filtered, sym);

  // Savings Summary
  const pctEl = document.getElementById('dashSavingsPercent');
  const subEl = document.getElementById('dashSavingsSub');
  const barEl = document.getElementById('dashSavingsBar');

  if (goals.length && pctEl && subEl && barEl) {
    const totalSaved = goals.reduce((sum, g) => sum + (Number(g.saved) || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + (Number(g.target) || 0), 0);
    const pct = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;
    pctEl.textContent = pct + '%';
    subEl.textContent = `${sym}${totalSaved.toLocaleString('en-NG')} of ${sym}${totalTarget.toLocaleString('en-NG')}`;
    barEl.style.width = pct + '%';
  } else if (pctEl && subEl && barEl) {
    pctEl.textContent = '0%';
    subEl.textContent = 'No active savings goals';
    barEl.style.width = '0%';
  }

  // Recent transactions
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const list = document.getElementById('recentTransactionsList');
  if (list) {
    list.innerHTML = sorted.length ? sorted.map(tx => txItemHTML(tx, sym)).join('') : '<div class="text-center py-10 text-slate-400 text-sm">No transactions this month. Add one with the button above!</div>';
  }

  // Donut chart
  renderDonut(filtered, sym);

  // Savings goals preview
  const sList = document.getElementById('dashSavingsGoals');
  if (sList) {
    sList.innerHTML = goals.slice(0, 3).map(g => savingsItemHTML(g, sym)).join('') || '<div class="text-center py-8 text-slate-400 text-sm">No savings goals yet. Create one in Savings Goals!</div>';
  }
};

function txItemHTML(tx, sym) {
  const icon = CATEGORY_ICONS[tx.category] || 'fa-box';
  let classBadge = '';
  if (tx.type === 'expense') {
    const cls = AppState.getTransactionClassification(tx);
    if (cls === 'Growth') {
      classBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"><i class="fa-solid fa-arrow-trend-up text-[8px]"></i> Growth</span>`;
    } else if (cls === 'Optional') {
      classBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"><i class="fa-solid fa-wand-magic-sparkles text-[8px]"></i> Optional</span>`;
    } else {
      classBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"><i class="fa-solid fa-shield-halved text-[8px]"></i> Essential</span>`;
    }
  }

  return `
    <div class="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${tx.type==='income'?'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400':'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}">
        <i class="fa-solid ${tx.type==='income'?'fa-arrow-up':'fa-arrow-down'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-slate-900 dark:text-white truncate">${tx.desc}</span>
          ${classBadge}
        </div>
        <div class="text-xs text-slate-400 mt-0.5">${tx.type==='income'?'Income':'Expense'} • <i class="fa-solid ${icon} text-[10px]"></i> ${tx.category}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs text-slate-400">${formatDate(tx.date)}</div>
        <div class="text-sm font-extrabold ${tx.type==='income'?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}">${tx.type==='income'?'+':'-'}${formatCurrency(tx.amount, sym)}</div>
      </div>
    </div>`;
}

function savingsItemHTML(g, sym) {
  const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
  return `
    <div class="flex items-center gap-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4 shadow-sm">
      <div class="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-piggy-bank"></i></div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-sm text-slate-900 dark:text-white truncate">${g.name}</div>
        <div class="text-xs text-slate-400">${g.desc || 'Savings target'}</div>
        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
          <div class="h-full bg-primary-600 rounded-full transition-all" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-sm font-extrabold text-primary-600 dark:text-primary-400">${sym}${(g.saved||0).toLocaleString('en-NG')}</div>
        <div class="text-xs text-slate-400">of ${sym}${(g.target||0).toLocaleString('en-NG')} (${pct}%)</div>
      </div>
    </div>`;
}

function renderDonut(filtered, sym) {
  const expenses = filtered.filter(t => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const centerAmtEl = document.getElementById('chartCenterAmt');
  if (centerAmtEl) centerAmtEl.textContent = formatCurrency(total, sym);

  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount));
  const labels = Object.keys(byCat);
  const data = labels.map(l => byCat[l]);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#9CA3AF');

  const canvas = document.getElementById('categoryDonutChart');
  const legendEl = document.getElementById('categoryLegend');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (donutChart) donutChart.destroy();

  if (!labels.length) {
    if (legendEl) legendEl.innerHTML = '<div class="text-center py-4 text-slate-400 text-sm">No expenses recorded for this month</div>';
    return;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => ` ${sym}${c.parsed.toLocaleString('en-NG')} (${Math.round((c.parsed / total) * 100)}%)`
          }
        }
      },
      animation: { duration: 400 }
    }
  });

  if (legendEl) {
    legendEl.innerHTML = labels.map((l, i) => `
      <div class="flex items-center justify-between text-sm py-0.5">
        <div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]}"></div><span class="text-slate-600 dark:text-slate-300">${l}</span></div>
        <div class="flex gap-3"><span class="font-bold text-slate-900 dark:text-white">${sym}${data[i].toLocaleString('en-NG')}</span><span class="text-slate-400">${Math.round((data[i] / total) * 100)}%</span></div>
      </div>`).join('');
  }
}

// Initial setup
setupMonthYearFilter();
if (AppState.initialized) {
  window.renderDashboard();
} else {
  AppState.on('initialized', () => {
    window.renderDashboard();
  });
}
