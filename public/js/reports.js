// js/reports.js
import { initAuth, getCurrentUser } from "./auth.js";
import { getProfile, getTransactions, formatCurrency, showToast } from "./firebase.js";

initAuth();
let transactions = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
let donutChart = null, barChart = null;
const uid = () => getCurrentUser()?.uid;

const CATEGORY_COLORS = {
  Food: '#3B82F6', Transport: '#10B981', Shopping: '#F59E0B', Bills: '#8B5CF6',
  Education: '#06B6D4', Health: '#EF4444', Entertainment: '#F97316',
  Salary: '#22C55E', Business: '#6366F1', Investment: '#14B8A6',
  Savings: '#95e90e', Gift: '#EC4899', Others: '#9CA3AF'
};

async function init() {
  const u = uid(); if(!u) return;
  const [profileData, transactionsData] = await Promise.all([
    getProfile(u),
    getTransactions(u)
  ]);

  profile = profileData;
  transactions = transactionsData;
  setupMonthYearFilter();
  window.renderReports();
}

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; if(i===filterMonth) o.selected=true; monthEl.appendChild(o); });
  const cy = new Date().getFullYear();
  for(let y=cy-3; y<=cy+1; y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===filterYear) o.selected=true; yearEl.appendChild(o); }
  monthEl.addEventListener('change', () => { filterMonth=parseInt(monthEl.value); window.renderReports(); });
  yearEl.addEventListener('change', () => { filterYear=parseInt(yearEl.value); window.renderReports(); });
}

function getFiltered() {
  return transactions.filter(tx => { const d=new Date(tx.date); return d.getMonth()===filterMonth && d.getFullYear()===filterYear; });
}

window.renderReports = function() {
  const filtered = getFiltered();
  const sym = profile.currency || '₦';
  renderDonut(filtered, sym);
  renderBarChart(sym);
  renderInsight(filtered, sym);
}

function renderDonut(filtered, sym) {
  const expenses = filtered.filter(t=>t.type==='expense');
  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category]||0)+t.amount);
  const labels = Object.keys(byCat);
  const data = labels.map(l=>byCat[l]);
  const colors = labels.map(l=>CATEGORY_COLORS[l]||'#9CA3AF');
  const total = data.reduce((a,b)=>a+b,0);

  const ctx = document.getElementById('reportDonutChart')?.getContext('2d');
  if(!ctx) return;
  if(donutChart) donutChart.destroy();
  if(!labels.length){ document.getElementById('reportLegend').innerHTML = '<div class="text-center py-4 text-slate-400 text-sm">No expenses this month</div>'; return; }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: { cutout: '60%', plugins: { legend: { display: false } }, animation: { duration: 600 } }
  });

  document.getElementById('reportLegend').innerHTML = labels.map((l,i)=>`
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]}"></div><span class="text-slate-600">${l}</span></div>
      <div class="flex gap-3"><span class="font-semibold text-slate-900">${sym}${data[i].toLocaleString('en-NG')}</span><span class="text-slate-400">${total>0?Math.round((data[i]/total)*100):0}%</span></div>
    </div>`).join('');
}

function renderBarChart(sym) {
  const months = [], incomes = [], expenses = [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for(let i=5; i>=0; i--){
    const d = new Date(filterYear, filterMonth-i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    months.push(monthNames[m]+" '"+y.toString().slice(2));
    const txs = transactions.filter(t=>{ const td=new Date(t.date); return td.getMonth()===m && td.getFullYear()===y; });
    incomes.push(txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    expenses.push(txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }

  const ctx = document.getElementById('monthlyBarChart')?.getContext('2d');
  if(!ctx) return;
  if(barChart) barChart.destroy();

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
      plugins: { legend: { display: true, position: 'top' }, tooltip: { callbacks: { label: c => ` ${sym}${c.parsed.y.toLocaleString('en-NG')}` } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => sym+v.toLocaleString('en-NG') }, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } },
      animation: { duration: 600 }
    }
  });
}

function renderInsight(filtered, sym) {
  const expenses = filtered.filter(t=>t.type==='expense');
  const income = filtered.filter(t=>t.type==='income');
  const el = document.getElementById('spendingInsight');
  if(!expenses.length){ el.innerHTML = 'Add some expense transactions to see spending insights.'; return; }

  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category]||0)+t.amount);
  const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const totalExp = expenses.reduce((s,t)=>s+t.amount,0);
  const totalInc = income.reduce((s,t)=>s+t.amount,0);
  const balance = Math.max(0, totalInc - totalExp);
  const savingsRate = totalInc>0 ? Math.round(((totalInc-totalExp)/totalInc)*100) : 0;

  let html = `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-chart-simple text-primary-500 mt-0.5"></i><span>You spent most on <strong>${topCat[0]}</strong> (${sym}${topCat[1].toLocaleString('en-NG')}).</span></div>`;
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-briefcase text-income-500 mt-0.5"></i><span>Total income: <strong>${sym}${totalInc.toLocaleString('en-NG')}</strong> | Total expenses: <strong>${sym}${totalExp.toLocaleString('en-NG')}</strong></span></div>`;
  html += `<div class="flex items-start gap-3 mb-3"><i class="fa-solid fa-piggy-bank text-primary-500 mt-0.5"></i><span>Remaining balance: <strong>${sym}${balance.toLocaleString('en-NG')}</strong></span></div>`;
  html += savingsRate>=20
    ? `<div class="flex items-start gap-3"><i class="fa-solid fa-check text-emerald-500 mt-0.5"></i><span>Great job! You saved <strong>${savingsRate}%</strong> of your income this month.</span></div>`
    : savingsRate>=0
      ? `<div class="flex items-start gap-3"><i class="fa-solid fa-lightbulb text-amber-500 mt-0.5"></i><span>You saved <strong>${savingsRate}%</strong> of your income. Try to save at least 20%.</span></div>`
      : `<div class="flex items-start gap-3"><i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5"></i><span>You spent more than you earned this month! Review your expenses.</span></div>`;
  el.innerHTML = html;
}

init();
