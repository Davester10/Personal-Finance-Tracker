// js/budget.js
import { initAuth, getCurrentUser } from "./auth.js";
import { getProfile, getTransactions, getBudgets, setBudget, deleteBudget, formatCurrency, showToast } from "./firebase.js";

initAuth();
let transactions = [], budgets = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
const uid = () => getCurrentUser()?.uid;

async function init() {
  const u = uid(); if(!u) return;
  const [profileData, transactionsData, budgetsData] = await Promise.all([
    getProfile(u),
    getTransactions(u),
    getBudgets(u)
  ]);

  profile = profileData;
  transactions = transactionsData;
  budgets = budgetsData;
  setupMonthYearFilter();
  renderBudget();
}

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; if(i===filterMonth) o.selected=true; monthEl.appendChild(o); });
  const cy = new Date().getFullYear();
  for(let y=cy-3; y<=cy+1; y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===filterYear) o.selected=true; yearEl.appendChild(o); }
  monthEl.addEventListener('change', () => { filterMonth=parseInt(monthEl.value); window.renderBudget(); });
  yearEl.addEventListener('change', () => { filterYear=parseInt(yearEl.value); window.renderBudget(); });
}

function getExpenses() {
  return transactions.filter(tx => {
    const d=new Date(tx.date);
    return d.getMonth()===filterMonth && d.getFullYear()===filterYear && tx.type==='expense';
  });
}

window.renderBudget = function() {
  const expenses = getExpenses();
  const sym = profile.currency || '₦';
  const list = document.getElementById('budgetList');
  if(!budgets.length){ list.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">No budgets set yet. Click "+ Set Budget" to start!</div>'; return; }

  list.innerHTML = budgets.map(b => {
    const spent = expenses.filter(t=>t.category===b.category).reduce((s,t)=>s+t.amount,0);
    const pct = b.limit>0 ? Math.min(Math.round((spent/b.limit)*100),100) : 0;
    const over = spent > b.limit;
    const barColor = pct>=100 ? 'bg-red-500' : pct>=75 ? 'bg-amber-400' : 'bg-emerald-500';
    const statusColor = pct>=100 ? 'text-red-600' : pct>=75 ? 'text-amber-500' : 'text-emerald-600';
    const status = over ? `Over budget by ${sym}${(spent-b.limit).toLocaleString('en-NG')}` : `${100-pct}% of budget remaining`;
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-sm text-slate-900 flex items-center gap-2"><i class="fa-solid fa-tag text-primary-500"></i> ${b.category}</h4>
          <button onclick="deleteBudgetItem('${b.id}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>Spent: <strong class="text-slate-900">${sym}${spent.toLocaleString('en-NG')}</strong></span>
          <span>Limit: <strong class="text-slate-900">${sym}${b.limit.toLocaleString('en-NG')}</strong></span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
          <div class="h-full ${barColor} rounded-full transition-all" style="width:${pct}%"></div>
        </div>
        <div class="text-xs font-semibold ${statusColor}">${status}</div>
      </div>`;
  }).join('');
}

window.deleteBudgetItem = async function(id) {
  openConfirm('Delete this budget? This cannot be undone.', 'Delete Budget', 'Delete', async () => {
    const u = uid(); if(!u) return;
    await deleteBudget(u, id);
    showToast('Budget removed');
    budgets = await getBudgets(u);
    window.renderBudget();
  });
};

window.saveBudget = async function() {
  const category = document.getElementById('budgetCategory').value;
  const limit = parseFloat(document.getElementById('budgetLimit').value);
  if(!limit || limit<=0){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid limit'); return; }
  const u = uid(); if(!u) return;
  await setBudget(u, { category, limit });
  closeModal('budgetModal');
  showToast('<i class="fa-solid fa-bullseye"></i> Budget saved!');
  budgets = await getBudgets(u);
  window.renderBudget();
};

init();
