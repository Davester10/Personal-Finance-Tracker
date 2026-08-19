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
  renderInsight(filtered, sym);
};

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
    el.innerHTML = '<div class="text-slate-400 text-sm">Add some income and expense transactions to see spending insights and automated recommendations.</div>';
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
    html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-chart-simple text-primary-500 mt-0.5"></i><span>You spent most on <strong>${topCatEntry[0]}</strong> (${sym}${topCatEntry[1].toLocaleString('en-NG')}).</span></div>`;
  }
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-briefcase text-emerald-500 mt-0.5"></i><span>Total income: <strong>${sym}${totalInc.toLocaleString('en-NG')}</strong> | Total expenses: <strong>${sym}${totalExp.toLocaleString('en-NG')}</strong></span></div>`;
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-piggy-bank text-primary-500 mt-0.5"></i><span>Remaining monthly balance: <strong>${sym}${balance.toLocaleString('en-NG')}</strong></span></div>`;

  if (totalInc > 0) {
    html += savingsRate >= 20
      ? `<div class="flex items-start gap-3"><i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i><span>Great job! You saved <strong>${savingsRate}%</strong> of your income this month.</span></div>`
      : savingsRate >= 0
        ? `<div class="flex items-start gap-3"><i class="fa-solid fa-lightbulb text-amber-500 mt-0.5"></i><span>You saved <strong>${savingsRate}%</strong> of your income. Target saving at least 20% for faster financial growth.</span></div>`
        : `<div class="flex items-start gap-3"><i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5"></i><span>You spent more than you earned this month! Review your budget to curb discretionary spending.</span></div>`;
  }

  el.innerHTML = html;
}

setupMonthYearFilter();
if (AppState.initialized) {
  window.renderReports();
} else {
  AppState.on('initialized', () => window.renderReports());
}
