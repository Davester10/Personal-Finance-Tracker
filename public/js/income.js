// js/income.js
import { initAuth, getCurrentUser } from "./auth.js";
import { getTransactions, formatCurrency, formatDate, showToast, todayDateString } from "./firebase.js";

initAuth();
let transactions = [], profile = { currency: "₦" };
let filterMonth = new Date().getMonth(), filterYear = new Date().getFullYear();
const uid = () => getCurrentUser()?.uid;
const cats = ['Food','Transport','Shopping','Bills','Education','Health','Entertainment','Salary','Business','Investment','Gift','Others'];

async function init() {
  const u = uid(); if(!u) return;
  profile = (await import("./firebase.js")).getProfile(u);
  transactions = await getTransactions(u);
  populateFilters();
  setupMonthYearFilter();
  window.renderIncome();
}

function populateFilters() {
  const el = document.getElementById('incomeCatFilter');
  cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; el.appendChild(o); });
}

function setupMonthYearFilter() {
  const monthEl = document.getElementById('monthFilter');
  const yearEl = document.getElementById('yearFilter');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; if(i===filterMonth) o.selected=true; monthEl.appendChild(o); });
  const cy = new Date().getFullYear();
  for(let y=cy-3; y<=cy+1; y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===filterYear) o.selected=true; yearEl.appendChild(o); }
  monthEl.addEventListener('change', () => { filterMonth=parseInt(monthEl.value); window.renderIncome(); });
  yearEl.addEventListener('change', () => { filterYear=parseInt(yearEl.value); window.renderIncome(); });
}

function getFiltered() {
  return transactions.filter(tx => {
    const d=new Date(tx.date);
    return d.getMonth()===filterMonth && d.getFullYear()===filterYear && tx.type==='income';
  });
}

window.renderIncome = function() {
  let items = getFiltered();
  const search = (document.getElementById('incomeSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('incomeCatFilter')?.value || '';
  if(search) items = items.filter(t => t.desc.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));
  if(cat) items = items.filter(t => t.category===cat);

  const total = getFiltered().reduce((s,t)=>s+t.amount,0);
  const sym = profile.currency || '₦';
  document.getElementById('incomePageTotal').textContent = formatCurrency(total, sym);
  document.getElementById('incomePageCount').textContent = getFiltered().length;

  const list = document.getElementById('incomeList');
  if(!items.length){ list.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">No income transactions found.</div>'; return; }
  const sorted = [...items].sort((a,b)=>new Date(b.date)-new Date(a.date));
  list.innerHTML = sorted.map(tx=>txItemHTML(tx,sym)).join('');
}

function txItemHTML(tx, sym) {
  const icons = { Food:'fa-utensils', Transport:'fa-car', Shopping:'fa-bag-shopping', Bills:'fa-bolt', Education:'fa-book', Health:'fa-heart', Entertainment:'fa-film', Salary:'fa-briefcase', Business:'fa-building', Investment:'fa-chart-line', Gift:'fa-gift', Others:'fa-box' };
  return `
    <div class="flex items-center gap-3.5 px-2 py-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div class="w-9 h-9 rounded-full bg-income-100 text-income-600 flex items-center justify-center text-sm"><i class="fa-solid fa-arrow-up"></i></div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm text-slate-900 truncate">${tx.desc}</div>
        <div class="text-xs text-slate-400 mt-0.5">Income • <i class="fa-solid ${icons[tx.category]||'fa-box'} text-[10px]"></i> ${tx.category}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-xs text-slate-400">${formatDate(tx.date)}</div>
        <div class="text-sm font-bold text-income-600">+${formatCurrency(tx.amount, sym)}</div>
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
    window.renderIncome();
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
  showToast('<i class="fa-solid fa-money-bill-wave"></i> Income added!');
  transactions = await getTransactions(u);
  window.renderIncome();
};

document.getElementById('txDate').value = todayDateString();
init();
