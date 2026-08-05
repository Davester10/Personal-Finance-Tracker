// js/dashboard.js
import { initAuth, getCurrentUser } from "./auth.js";
import {
  getTransactions, getBudgets, getGoals, getProfile, formatCurrency, formatDate, showToast, todayDateString
} from "./firebase.js";

initAuth();

let transactions = [], budgets = [], goals = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
let donutChart = null;
const uid = () => getCurrentUser()?.uid;

const CATEGORY_COLORS = {
  Food: '#3B82F6', Transport: '#10B981', Shopping: '#F59E0B', Bills: '#8B5CF6',
  Education: '#06B6D4', Health: '#EF4444', Entertainment: '#F97316',
  Salary: '#22C55E', Business: '#6366F1', Investment: '#14B8A6',
  Savings: '#95e90e', Gift: '#EC4899', Others: '#9CA3AF'
};
const CATEGORY_ICONS = {
  Food: 'fa-utensils', Transport: 'fa-car', Shopping: 'fa-bag-shopping', Bills: 'fa-bolt',
  Education: 'fa-book', Health: 'fa-heart', Entertainment: 'fa-film',
  Salary: 'fa-briefcase', Business: 'fa-building', Investment: 'fa-chart-line',
  Gift: 'fa-gift', Others: 'fa-box'
};

async function init() {
  const u = uid(); if(!u) return;
  const [profileData, transactionsData, budgetsData, goalsData] = await Promise.all([
    getProfile(u),
    getTransactions(u),
    getBudgets(u),
    getGoals(u)
  ]);

  profile = profileData;
  transactions = transactionsData;
  budgets = budgetsData;
  goals = goalsData;
  setupMonthYearFilter();
  renderDashboard();
  updateGreeting();
}

function updateGreeting() {
  const hour = new Date().getHours();
  let g = 'Good morning'; if(hour>=12 && hour<17) g='Good afternoon'; if(hour>=17) g='Good evening';
  const currentUser = getCurrentUser();
  const displayName = (profile?.name && profile.name !== 'User') ? profile.name : (currentUser?.name || 'User');
  document.getElementById('greetingText').textContent = `${g}, ${displayName}!`;
  document.getElementById('headerAvatar').textContent = (displayName || 'U').charAt(0).toUpperCase();
}

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; if(i===filterMonth) o.selected=true; monthEl.appendChild(o); });
  const cy = new Date().getFullYear();
  for(let y=cy-3; y<=cy+1; y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===filterYear) o.selected=true; yearEl.appendChild(o); }
  monthEl.addEventListener('change', () => { filterMonth=parseInt(monthEl.value); window.renderDashboard(); });
  yearEl.addEventListener('change', () => { filterYear=parseInt(yearEl.value); window.renderDashboard(); });
}

function getFiltered() {
  return transactions.filter(tx => { const d=new Date(tx.date); return d.getMonth()===filterMonth && d.getFullYear()===filterYear; });
}

window.renderDashboard = function() {
  const filtered = getFiltered();
  const totalIncome = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance = Math.max(0, totalIncome - totalExpense);
  const sym = profile.currency || '₦';

  document.getElementById('dashTotalIncome').textContent = formatCurrency(totalIncome, sym);
  document.getElementById('dashTotalExpense').textContent = formatCurrency(totalExpense, sym);
  document.getElementById('dashBalance').textContent = formatCurrency(balance, sym);

  // Savings
  if(goals.length) {
    const totalSaved = goals.reduce((sum, g) => sum + (Number(g.saved) || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + (Number(g.target) || 0), 0);
    const pct = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;
    document.getElementById('dashSavingsPercent').textContent = pct+'%';
    document.getElementById('dashSavingsSub').textContent = `${sym}${totalSaved.toLocaleString('en-NG')} of ${sym}${totalTarget.toLocaleString('en-NG')}`;
    document.getElementById('dashSavingsBar').style.width = pct+'%';
  }

  // Recent transactions
  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const list = document.getElementById('recentTransactionsList');
  list.innerHTML = sorted.length ? sorted.map(tx=>txItemHTML(tx)).join('') : '<div class="text-center py-10 text-slate-400 text-sm">No transactions this month. Add one!</div>';

  // Donut chart
  renderDonut(filtered, sym);

  // Savings preview
  const sList = document.getElementById('dashSavingsGoals');
  sList.innerHTML = goals.slice(0,3).map(g=>savingsItemHTML(g,sym)).join('') || '<div class="text-center py-8 text-slate-400 text-sm">No savings goals yet.</div>';
}

function txItemHTML(tx) {
  const sym = profile.currency || '₦';
  const icon = CATEGORY_ICONS[tx.category] || 'fa-box';
  return `
    <div class="flex items-center gap-3.5 px-2 py-3 rounded-xl hover:bg-slate-50 transition-colors cursor-default">
      <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm ${tx.type==='income'?'bg-income-100 text-income-600':'bg-expense-100 text-expense-600'}">
        <i class="fa-solid ${tx.type==='income'?'fa-arrow-up':'fa-arrow-down'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm text-slate-900 truncate">${tx.desc}</div>
        <div class="text-xs text-slate-400 mt-0.5">${tx.type==='income'?'Income':'Expense'} • <i class="fa-solid ${icon} text-[10px]"></i> ${tx.category}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs text-slate-400">${formatDate(tx.date)}</div>
        <div class="text-sm font-bold ${tx.type==='income'?'text-income-600':'text-expense-600'}">${tx.type==='income'?'+':'-'}${formatCurrency(tx.amount, sym)}</div>
      </div>
    </div>`;
}

function savingsItemHTML(g, sym) {
  const pct = g.target>0 ? Math.min(Math.round((g.saved/g.target)*100),100) : 0;
  return `
    <div class="flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div class="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-xl"><i class="fa-solid fa-piggy-bank"></i></div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm text-slate-900">${g.name}</div>
        <div class="text-xs text-slate-400">${g.desc || 'Savings goal'}</div>
        <div class="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
          <div class="h-full bg-primary-600 rounded-full transition-all" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-sm font-bold text-primary-600">${sym}${(g.saved||0).toLocaleString('en-NG')}</div>
        <div class="text-xs text-slate-400">of ${sym}${(g.target||0).toLocaleString('en-NG')}</div>
      </div>
    </div>`;
}

function renderDonut(filtered, sym) {
  const expenses = filtered.filter(t=>t.type==='expense');
  const total = expenses.reduce((s,t)=>s+t.amount,0);
  document.getElementById('chartCenterAmt').textContent = formatCurrency(total, sym);
  const byCat = {};
  expenses.forEach(t => byCat[t.category] = (byCat[t.category]||0)+t.amount);
  const labels = Object.keys(byCat);
  const data = labels.map(l=>byCat[l]);
  const colors = labels.map(l=>CATEGORY_COLORS[l]||'#9CA3AF');

  const ctx = document.getElementById('categoryDonutChart')?.getContext('2d');
  if(!ctx) return;
  if(donutChart) donutChart.destroy();
  if(!labels.length) { document.getElementById('categoryLegend').innerHTML = '<div class="text-center py-4 text-slate-400 text-sm">No expenses this month</div>'; return; }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
    options: { cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${sym}${c.parsed.toLocaleString('en-NG')} (${Math.round((c.parsed/total)*100)}%)` } } }, animation: { duration: 600 } }
  });

  document.getElementById('categoryLegend').innerHTML = labels.map((l,i)=>`
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]}"></div><span class="text-slate-600">${l}</span></div>
      <div class="flex gap-3"><span class="font-semibold text-slate-900">${sym}${data[i].toLocaleString('en-NG')}</span><span class="text-slate-400">${Math.round((data[i]/total)*100)}%</span></div>
    </div>`).join('');
}

// Transaction save from modal
window.saveTransaction = async function() {
  const type = document.getElementById('txType').value;
  const amount = parseFloat(document.getElementById('txAmount').value);
  const desc = document.getElementById('txDesc').value.trim();
  const category = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;
  const note = document.getElementById('txNote').value.trim();
  if(!amount || amount<=0){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid amount'); return; }
  if(!desc){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a description'); return; }
  if(!date){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Select a date'); return; }

  const u = uid(); if(!u) return;
  const { addTransaction } = await import("./firebase.js");
  await addTransaction(u, { type, amount, desc, category, date, note });
  closeModal('txModal');
  showToast(type==='income'?'<i class="fa-solid fa-money-bill-wave"></i> Income added!':'<i class="fa-solid fa-wallet"></i> Expense added!');
  transactions = await getTransactions(u);
  window.renderDashboard();
};

document.getElementById('txDate').value = todayDateString();
init();
