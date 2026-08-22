// js/reports.js
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
let donutChart = null, barChart = null;

const CATEGORY_COLORS = {
  'Food/groceries': '#3B82F6', Food: '#3B82F6', Bills: '#8B5CF6', Transport: '#10B981',
  Education: '#06B6D4', Shopping: '#F59E0B', Skincare: '#EC4899', Health: '#EF4444',
  Entertainment: '#F97316', Salary: '#22C55E', Gift: '#A855F7', Investment: '#14B8A6',
  Others: '#9CA3AF', Savings: '#10B981', Business: '#6366F1'
};

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
    window.renderReports();
  };
  yearEl.onchange = () => {
    filterYear = parseInt(yearEl.value);
    sessionStorage.setItem('mf_filter_year', filterYear);
    window.renderReports();
  };
}

function getFiltered() {
  const txs = AppState.transactions || [];
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });
}

window.renderReports = function() {
  const filtered = getFiltered();
  const sym = AppState.getCurrency();
  renderDonut(filtered, sym);
  renderBarChart(sym);
  renderValueBasedReport(filtered, sym);
  renderValueAndActivityAdvisory(filtered, sym);
  renderInsight(filtered, sym);
};

function renderValueBasedReport(filtered, sym) {
  const expenses = filtered.filter(t => t.type === 'expense');
  let essential = 0, growth = 0, optional = 0;
  let essentialCount = 0, growthCount = 0, optionalCount = 0;

  expenses.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    const cls = AppState.getTransactionClassification(tx);
    if (cls === 'Growth') {
      growth += amt;
      growthCount++;
    } else if (cls === 'Optional') {
      optional += amt;
      optionalCount++;
    } else {
      essential += amt;
      essentialCount++;
    }
  });

  const total = essential + growth + optional;
  const essentialPct = total > 0 ? Math.round((essential / total) * 100) : 0;
  const growthPct = total > 0 ? Math.round((growth / total) * 100) : 0;
  const optionalPct = total > 0 ? Math.round((optional / total) * 100) : 0;

  const essentialTotalEl = document.getElementById('essentialTotal');
  const essentialPctEl = document.getElementById('essentialPctBadge');
  const essentialCountEl = document.getElementById('essentialCount');

  const growthTotalEl = document.getElementById('growthTotal');
  const growthPctEl = document.getElementById('growthPctBadge');
  const growthCountEl = document.getElementById('growthCount');

  const optionalTotalEl = document.getElementById('optionalTotal');
  const optionalPctEl = document.getElementById('optionalPctBadge');
  const optionalCountEl = document.getElementById('optionalCount');

  const ratioSummaryEl = document.getElementById('valueRatioSummary');
  const barEssential = document.getElementById('barEssential');
  const barGrowth = document.getElementById('barGrowth');
  const barOptional = document.getElementById('barOptional');

  if (essentialTotalEl) essentialTotalEl.textContent = formatCurrency(essential, sym);
  if (essentialPctEl) essentialPctEl.textContent = `${essentialPct}%`;
  if (essentialCountEl) essentialCountEl.textContent = `${essentialCount} txn${essentialCount === 1 ? '' : 's'}`;

  if (growthTotalEl) growthTotalEl.textContent = formatCurrency(growth, sym);
  if (growthPctEl) growthPctEl.textContent = `${growthPct}%`;
  if (growthCountEl) growthCountEl.textContent = `${growthCount} txn${growthCount === 1 ? '' : 's'}`;

  if (optionalTotalEl) optionalTotalEl.textContent = formatCurrency(optional, sym);
  if (optionalPctEl) optionalPctEl.textContent = `${optionalPct}%`;
  if (optionalCountEl) optionalCountEl.textContent = `${optionalCount} txn${optionalCount === 1 ? '' : 's'}`;

  if (ratioSummaryEl) {
    ratioSummaryEl.textContent = total > 0
      ? `Essential ${essentialPct}% • Growth ${growthPct}% • Optional ${optionalPct}%`
      : 'No expenses recorded for this month';
  }

  if (barEssential) barEssential.style.width = `${essentialPct}%`;
  if (barGrowth) barGrowth.style.width = `${growthPct}%`;
  if (barOptional) barOptional.style.width = `${optionalPct}%`;
}

function renderValueAndActivityAdvisory(filtered, sym) {
  const container = document.getElementById('valueAdvisoryContainer');
  if (!container) return;

  const expenses = filtered.filter(t => t.type === 'expense');
  const income = filtered.filter(t => t.type === 'income');

  if (!expenses.length && !income.length) {
    container.innerHTML = '<div class="text-slate-400 text-sm py-2">Add some income and expense transactions to see automated value and activity findings.</div>';
    return;
  }

  let essential = 0, growth = 0, optional = 0;
  const optionalByCat = {};
  let weekendSpend = 0, weekendCount = 0;

  expenses.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    const cls = AppState.getTransactionClassification(tx);
    if (cls === 'Growth') {
      growth += amt;
    } else if (cls === 'Optional') {
      optional += amt;
      optionalByCat[tx.category] = (optionalByCat[tx.category] || 0) + amt;
    } else {
      essential += amt;
    }

    const d = new Date(tx.date);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      weekendSpend += amt;
      weekendCount++;
    }
  });

  const totalExp = essential + growth + optional;
  const optionalPct = totalExp > 0 ? Math.round((optional / totalExp) * 100) : 0;
  const growthPct = totalExp > 0 ? Math.round((growth / totalExp) * 100) : 0;
  const essentialPct = totalExp > 0 ? Math.round((essential / totalExp) * 100) : 0;
  const avgSpend = expenses.length > 0 ? Math.round(totalExp / expenses.length) : 0;
  const weekendPct = totalExp > 0 ? Math.round((weekendSpend / totalExp) * 100) : 0;

  // Find top discretionary drain category
  const topOptCatEntry = Object.entries(optionalByCat).sort((a, b) => b[1] - a[1])[0];

  let cardsHtml = '';

  // 1. Cutback & Discretionary Spending Advisory
  if (optionalPct > 30) {
    const suggestedCutback = Math.round(optional * 0.25);
    cardsHtml += `
      <div class="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <i class="fa-solid fa-scissors text-base"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 class="font-bold text-sm text-amber-900 dark:text-amber-300">Actionable Cutback Opportunity</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">Optional Spending: ${optionalPct}%</span>
          </div>
          <p class="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            Optional spending is high at <strong>${optionalPct}%</strong> (${sym}${optional.toLocaleString('en-NG')})${topOptCatEntry ? `, heavily driven by <strong>${topOptCatEntry[0]}</strong> (${sym}${topOptCatEntry[1].toLocaleString('en-NG')})` : ''}.
            Trimming 25% from optional spends would save you approximately <strong>${sym}${suggestedCutback.toLocaleString('en-NG')}</strong> this month to accelerate your savings goals.
          </p>
        </div>
      </div>`;
  } else if (optionalPct > 0) {
    cardsHtml += `
      <div class="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <i class="fa-solid fa-circle-check text-base"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 class="font-bold text-sm text-emerald-900 dark:text-emerald-300">Healthy Discretionary Balance</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">Optional: ${optionalPct}%</span>
          </div>
          <p class="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
            Great discipline! Your optional lifestyle spending is under control at <strong>${optionalPct}%</strong> (${sym}${optional.toLocaleString('en-NG')}), well within the healthy 20–25% limit.
          </p>
        </div>
      </div>`;
  }

  // 2. Growth & Future Development Advisory
  if (growthPct >= 20) {
    cardsHtml += `
      <div class="p-4 rounded-2xl bg-primary-50/70 dark:bg-primary-950/30 border border-primary-200/80 dark:border-primary-800/50 flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <i class="fa-solid fa-arrow-trend-up text-base"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 class="font-bold text-sm text-primary-900 dark:text-primary-300">Strong Growth & Investment Velocity</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary-200 dark:bg-primary-900/60 text-primary-900 dark:text-primary-200">Growth: ${growthPct}%</span>
          </div>
          <p class="text-xs text-primary-800 dark:text-primary-300/90 leading-relaxed">
            You allocated <strong>${growthPct}%</strong> (${sym}${growth.toLocaleString('en-NG')}) to Growth and Future investments. You are investing in high-ROI assets and skill development.
          </p>
        </div>
      </div>`;
  } else if (totalExp > 0) {
    cardsHtml += `
      <div class="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <i class="fa-solid fa-seedling text-base"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 class="font-bold text-sm text-blue-900 dark:text-blue-300">Growth Allocation Opportunity</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200">Growth: ${growthPct}%</span>
          </div>
          <p class="text-xs text-blue-800 dark:text-blue-300/90 leading-relaxed">
            ${growthPct === 0
              ? `You currently have <strong>0%</strong> allocated to Growth. Consider channeling 15–20% of your budget into courses, books, tools, or investment assets to build compounding wealth.`
              : `Your growth spending is at <strong>${growthPct}%</strong> (${sym}${growth.toLocaleString('en-NG')}). Aim to push this closer to 20–25% for faster personal and financial advancement.`
            }
          </p>
        </div>
      </div>`;
  }

  // 3. Activity-Based Behavioral Findings
  if (expenses.length > 0) {
    cardsHtml += `
      <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <i class="fa-solid fa-chart-line text-base"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 class="font-bold text-sm text-slate-900 dark:text-white">Activity-Based Behavioral Pattern</h4>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">${expenses.length} txns</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            You recorded <strong>${expenses.length} transactions</strong> with an average spend velocity of <strong>${sym}${avgSpend.toLocaleString('en-NG')}</strong> per transaction.
            ${weekendCount > 0
              ? ` Weekend activity accounts for <strong>${weekendPct}%</strong> (${sym}${weekendSpend.toLocaleString('en-NG')} across ${weekendCount} txns).`
              : ` No weekend transactions recorded this month.`
            }
          </p>
        </div>
      </div>`;
  }

  container.innerHTML = cardsHtml || '<div class="text-slate-400 text-sm">No insights to display.</div>';
}

function renderDonut(filtered, sym) {
  const expenses = filtered.filter(t => t.type === 'expense');
  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0));
  const labels = Object.keys(byCat);
  const data = labels.map(l => byCat[l]);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#9CA3AF');
  const total = data.reduce((a, b) => a + b, 0);

  const canvas = document.getElementById('reportDonutChart');
  const legendEl = document.getElementById('reportLegend');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (donutChart) donutChart.destroy();

  if (!labels.length) {
    if (legendEl) legendEl.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">No expenses recorded for this month</div>';
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
        borderColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'
      }]
    },
    options: {
      cutout: '60%',
      plugins: { legend: { display: false } },
      animation: { duration: 400 }
    }
  });

  if (legendEl) {
    legendEl.innerHTML = labels.map((l, i) => `
      <div class="flex items-center justify-between text-sm py-1">
        <div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]}"></div><span class="text-slate-600 dark:text-slate-300 font-medium">${l}</span></div>
        <div class="flex gap-3"><span class="font-bold text-slate-900 dark:text-white">${sym}${data[i].toLocaleString('en-NG')}</span><span class="text-slate-400">${total > 0 ? Math.round((data[i] / total) * 100) : 0}%</span></div>
      </div>`).join('');
  }
}

function renderBarChart(sym) {
  const months = [], incomes = [], expenses = [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const allTxs = AppState.transactions || [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(filterYear, filterMonth - i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    months.push(monthNames[m] + " '" + y.toString().slice(2));
    const txs = allTxs.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    incomes.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0));
    expenses.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0));
  }

  const canvas = document.getElementById('monthlyBarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomes, backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
        { label: 'Expenses', data: expenses, backgroundColor: '#ffe4e6', borderColor: '#f43f5e', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { callbacks: { label: c => ` ${sym}${c.parsed.y.toLocaleString('en-NG')}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => sym + v.toLocaleString('en-NG') },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        x: { grid: { display: false } }
      },
      animation: { duration: 400 }
    }
  });
}

function renderInsight(filtered, sym) {
  const expenses = filtered.filter(t => t.type === 'expense');
  const income = filtered.filter(t => t.type === 'income');
  const el = document.getElementById('spendingInsight');
  if (!el) return;

  if (!expenses.length && !income.length) {
    el.innerHTML = '<div class="text-slate-400 text-sm">Add some income and expense transactions to see cash flow summary.</div>';
    return;
  }

  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0));
  const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const totalExp = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalInc = income.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const balance = Math.max(0, totalInc - totalExp);
  const savingsRate = totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 100) : 0;

  let html = '';
  if (topCatEntry) {
    html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-chart-pie text-primary-500 mt-0.5"></i><span>Highest expense category: <strong>${topCatEntry[0]}</strong> (${sym}${topCatEntry[1].toLocaleString('en-NG')}).</span></div>`;
  }
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-briefcase text-emerald-500 mt-0.5"></i><span>Total monthly income: <strong>${sym}${totalInc.toLocaleString('en-NG')}</strong> | Total expenses: <strong>${sym}${totalExp.toLocaleString('en-NG')}</strong></span></div>`;
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-piggy-bank text-primary-500 mt-0.5"></i><span>Net monthly cash flow: <strong>${sym}${balance.toLocaleString('en-NG')}</strong></span></div>`;

  if (totalInc > 0) {
    html += savingsRate >= 20
      ? `<div class="flex items-start gap-3"><i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i><span>Great job! You saved <strong>${savingsRate}%</strong> of your income this month.</span></div>`
      : savingsRate >= 0
        ? `<div class="flex items-start gap-3"><i class="fa-solid fa-lightbulb text-amber-500 mt-0.5"></i><span>You saved <strong>${savingsRate}%</strong> of your income. Target saving at least 20% for faster financial growth.</span></div>`
        : `<div class="flex items-start gap-3"><i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5"></i><span>You spent more than you earned this month! Review your cutback recommendations above.</span></div>`;
  }

  el.innerHTML = html;
}

setupMonthYearFilter();
if (AppState.initialized) {
  window.renderReports();
} else {
  AppState.on('initialized', () => window.renderReports());
}
