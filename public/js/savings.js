// js/savings.js
import { initAuth, getCurrentUser } from "./auth.js";
import { getProfile, getGoals, addGoal, updateGoal, deleteGoal, getTransactions, addTransaction, formatCurrency, showToast, todayDateString } from "./firebase.js";

initAuth();
let goals = [], transactions = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
const uid = () => getCurrentUser()?.uid;
let selectedGoalId = null;

async function init() {
  const u = uid(); if(!u) return;
  const [profileData, goalsData, transactionsData] = await Promise.all([
    getProfile(u),
    getGoals(u),
    getTransactions(u)
  ]);

  profile = profileData;
  goals = goalsData;
  transactions = transactionsData;
  setupMonthYearFilter();
  window.renderSavings();
}

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

  monthEl.addEventListener('change', () => {
    filterMonth = Number(monthEl.value);
    window.renderSavings();
  });

  yearEl.addEventListener('change', () => {
    filterYear = Number(yearEl.value);
    window.renderSavings();
  });
}

function getFilteredTransactions() {
  return transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });
}

function getBalance() {
  const inc = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+(Number(t.amount)||0),0);
  const exp = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+(Number(t.amount)||0),0);
  return inc - exp;
}

window.renderSavings = function() {
  const sym = profile.currency || '₦';
  const list = document.getElementById('savingsList');
  if(!goals.length){ list.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">No savings goals yet. Create one!</div>'; return; }

  list.innerHTML = goals.map(g => {
    const pct = g.target>0 ? Math.min(Math.round((g.saved/g.target)*100),100) : 0;
    return `
      <div class="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-wrap">
        <div class="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-piggy-bank"></i></div>
        <div class="flex-1 min-w-[180px]">
          <div class="font-bold text-sm text-slate-900">${g.name}</div>
          <div class="text-xs text-slate-400">${g.desc || 'Savings goal'}</div>
          <div class="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div class="h-full bg-primary-600 rounded-full transition-all" style="width:${pct}%"></div>
          </div>
          <div class="text-xs font-bold text-primary-600 mt-1">${pct}%</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-lg font-extrabold text-primary-600">${sym}${(g.saved||0).toLocaleString('en-NG')}</div>
          <div class="text-xs text-slate-400">of ${sym}${(g.target||0).toLocaleString('en-NG')}</div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button onclick="addFunds('${g.id}')" class="px-3 py-2 rounded-lg bg-primary-50 text-primary-600 text-xs font-semibold hover:bg-primary-600 hover:text-white transition-colors">+ Add Funds</button>
          <button onclick="deleteGoalItem('${g.id}')" class="w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

window.addFunds = function(id) {
  selectedGoalId = id;
  document.getElementById('addFundsAmount').value = '';
  document.getElementById('addFundsNote').value = '';
  openModal('addFundsModal');
};

window.saveFundsToGoal = async function() {
  const amount = parseFloat(document.getElementById('addFundsAmount').value);
  const note = document.getElementById('addFundsNote').value.trim();
  if(!amount || amount<=0){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid amount'); return; }
  const balance = getBalance();
  const sym = profile.currency || '₦';
  if(balance <= 0 || amount >= balance){ showToast(`<i class="fa-solid fa-circle-exclamation"></i> Insufficient funds`); return; }

  const u = uid(); if(!u) return;
  const goal = goals.find(g=>g.id===selectedGoalId);
  if(!goal){ showToast('Goal not found'); closeModal('addFundsModal'); return; }

  try {
    await addTransaction(u, {
      type: 'expense', amount, desc: `Savings transfer to ${goal.name}`,
      category: 'Savings', date: todayDateString(), note: note || 'Savings goal transfer'
    });
  } catch (error) {
    showToast('<i class="fa-solid fa-circle-exclamation"></i> Insufficient funds');
    return;
  }
  await updateGoal(u, selectedGoalId, { saved: (goal.saved||0) + amount });
  closeModal('addFundsModal');
  if (typeof window.resetAddFundsForm === 'function') {
    window.resetAddFundsForm();
  }
  showToast('<i class="fa-solid fa-circle-check"></i> Funds added!');
  goals = await getGoals(u);
  transactions = await getTransactions(u);
  window.renderSavings();
};

window.deleteGoalItem = async function(id) {
  openConfirm('Delete this savings goal? This cannot be undone.', 'Delete Goal', 'Delete', async () => {
    const u = uid(); if(!u) return;
    await deleteGoal(u, id);
    showToast('Goal deleted');
    goals = await getGoals(u);
    transactions = await getTransactions(u);
    window.renderSavings();
  });
};

window.saveSavingsGoal = async function() {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const saved = parseFloat(document.getElementById('goalSaved').value) || 0;
  const desc = document.getElementById('goalDesc').value.trim();
  if(!name){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a goal name'); return; }
  if(!target || target<=0){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Enter a valid target'); return; }

  const u = uid(); if(!u) return;
  const goalData = { name, target, saved, desc };
  if(saved>0) {
    const balance = getBalance();
    if(balance <= 0 || saved >= balance){ showToast('<i class="fa-solid fa-circle-exclamation"></i> Insufficient funds'); return; }
    const { addTransaction } = await import("./firebase.js");
    try {
      await addTransaction(u, { type:'expense', amount:saved, desc:`Initial savings for ${name}`, category:'Savings', date:todayDateString(), note:'Savings goal initial transfer' });
    } catch (error) {
      showToast('<i class="fa-solid fa-circle-exclamation"></i> Insufficient funds');
      return;
    }
  }
  await addGoal(u, goalData);
  closeModal('savingsModal');
  if (typeof window.resetSavingsGoalForm === 'function') {
    window.resetSavingsGoalForm();
  }
  showToast('<i class="fa-solid fa-piggy-bank"></i> Goal created!');
  goals = await getGoals(u);
  transactions = await getTransactions(u);
  window.renderSavings();
};

init();
