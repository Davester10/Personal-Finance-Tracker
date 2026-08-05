// js/transactions.js
import { initAuth, getCurrentUser } from "./auth.js";
import { getProfile, getTransactions, formatCurrency, formatDate, showToast, todayDateString } from "./firebase.js";

initAuth();
let transactions = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
const uid = () => getCurrentUser()?.uid;
const cats = ['Food','Transport','Shopping','Bills','Education','Health','Entertainment','Salary','Business','Investment','Gift','Others'];

async function init() {
  const u = uid(); if(!u) return;
  const [profileData, transactionsData] = await Promise.all([
    getProfile(u),
    getTransactions(u)
  ]);

  profile = profileData;
  transactions = transactionsData;
  populateFilters();
  setupMonthYearFilter();
  window.renderTransactions();
}

function populateFilters() {
  const el = document.getElementById('txCatFilter');
  cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; el.appendChild(o); });
}

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; if(i===filterMonth) o.selected=true; monthEl.appendChild(o); });
  const cy = new Date().getFullYear();
  for(let y=cy-3; y<=cy+1; y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===filterYear) o.selected=true; yearEl.appendChild(o); }
  monthEl.addEventListener('change', () => { filterMonth=parseInt(monthEl.value); window.renderTransactions(); });
  yearEl.addEventListener('change', () => { filterYear=parseInt(yearEl.value); window.renderTransactions(); });
}

function getFiltered() {
  return transactions.filter(tx => { const d=new Date(tx.date); return d.getMonth()===filterMonth && d.getFullYear()===filterYear; });
}

window.renderTransactions = function() {
  let items = getFiltered();
  const search = (document.getElementById('txSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('txTypeFilter')?.value || '';
  const cat = document.getElementById('txCatFilter')?.value || '';
  if(search) items = items.filter(t => t.desc.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));
  if(typeFilter) items = items.filter(t => t.type===typeFilter);
  if(cat) items = items.filter(t => t.category===cat);

  const sym = profile.currency || '₦';
  const list = document.getElementById('allTransactionsList');
  if(!items.length){ list.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">No transactions found.</div>'; return; }
  const sorted = [...items].sort((a,b)=>new Date(b.date)-new Date(a.date));
  list.innerHTML = sorted.map(tx=>txItemHTML(tx,sym)).join('');
}

function txItemHTML(tx, sym) {
  const icons = { Food:'fa-utensils', Transport:'fa-car', Shopping:'fa-bag-shopping', Bills:'fa-bolt', Education:'fa-book', Health:'fa-heart', Entertainment:'fa-film', Salary:'fa-briefcase', Business:'fa-building', Investment:'fa-chart-line', Gift:'fa-gift', Others:'fa-box' };
  return `
    <div class="flex items-center gap-3.5 px-2 py-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div class="w-9 h-9 rounded-full ${tx.type==='income'?'bg-income-100 text-income-600':'bg-expense-100 text-expense-600'} flex items-center justify-center text-sm">
        <i class="fa-solid ${tx.type==='income'?'fa-arrow-up':'fa-arrow-down'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm text-slate-900 truncate">${tx.desc}</div>
        <div class="text-xs text-slate-400 mt-0.5">${tx.type==='income'?'Income':'Expense'} • <i class="fa-solid ${icons[tx.category]||'fa-box'} text-[10px]"></i> ${tx.category}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs text-slate-400">${formatDate(tx.date)}</div>
        <div class="text-sm font-bold ${tx.type==='income'?'text-income-600':'text-expense-600'}">${tx.type==='income'?'+':'-'}${formatCurrency(tx.amount, sym)}</div>
      </div>
      <button onclick="deleteTx('${tx.id}')" class="shrink-0 w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

window.deleteTx = async function(id) {
  openConfirm('Delete this transaction? This cannot be undone.', 'Delete Transaction', 'Delete', async () => {
    const u = uid(); if(!u) return;
    const { deleteTransaction } = await import("./firebase.js");
    await deleteTransaction(u, id);
    showToast('Transaction deleted');
    transactions = await getTransactions(u);
    window.renderTransactions();
  });
};

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
  showToast('<i class="fa-solid fa-check-circle"></i> Transaction added!');
  transactions = await getTransactions(u);
  window.renderTransactions();
};

document.getElementById('txDate').value = todayDateString();
init();
