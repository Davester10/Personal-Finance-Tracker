// js/settings.js
import { initAuth, getCurrentUser, setStoredTheme, getStoredTheme } from "./auth.js";
import { getProfile, saveProfile, getSettings, saveSettings, showToast } from "./firebase.js";

initAuth();
const uid = () => getCurrentUser()?.uid;
let filterMonth = new Date().getMonth();
let filterYear = new Date().getFullYear();

function syncSessionProfile(name, email) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const updatedSession = {
    ...currentUser,
    name: name || currentUser.name || 'User',
    email: email || currentUser.email || ''
  };

  sessionStorage.setItem('mf_user', JSON.stringify(updatedSession));
  if (localStorage.getItem('mf_user')) {
    localStorage.setItem('mf_user', JSON.stringify(updatedSession));
  }
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
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === filterYear) option.selected = true;
    yearEl.appendChild(option);
  }

  monthEl.addEventListener('change', () => {
    filterMonth = Number(monthEl.value);
  });

  yearEl.addEventListener('change', () => {
    filterYear = Number(yearEl.value);
  });
}

async function init() {
  const u = uid(); if (!u) return;

  const sessionUser = getCurrentUser();
  const profile = await getProfile(u);
  const settings = await getSettings(u);

  const profileName = (profile.name && profile.name !== 'User') ? profile.name : (sessionUser?.name || 'User');
  const profileEmail = (profile.email && profile.email !== '') ? profile.email : (sessionUser?.email || '');

  document.getElementById('profileName').value = profileName;
  document.getElementById('profileEmail').value = profileEmail;
  document.getElementById('profilePhone').value = profile.phone || '';
  document.getElementById('profileCurrency').value = profile.currency || '₦';
  document.getElementById('profileAvatarBig').textContent = (profileName || 'U').charAt(0).toUpperCase();

  const storedTheme = getStoredTheme();
  if (storedTheme !== null) {
    document.getElementById('darkModeToggle').checked = storedTheme;
  } else if (settings.darkMode) {
    setStoredTheme(true);
    document.getElementById('darkModeToggle').checked = true;
  }

  setupMonthYearFilter();
}

window.saveProfile = async function() {
  const u = uid(); if(!u) return;
  const data = {
    name: document.getElementById('profileName').value.trim() || 'User',
    email: document.getElementById('profileEmail').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
    currency: document.getElementById('profileCurrency').value
  };

  await saveProfile(u, data);
  syncSessionProfile(data.name, data.email);
  showToast('<i class="fa-solid fa-check"></i> Profile saved!');

  document.getElementById('profileAvatarBig').textContent = data.name.charAt(0).toUpperCase();
  const greeting = document.getElementById('greetingText');
  const headerAvatar = document.getElementById('headerAvatar');

  if (greeting) {
    const hour = new Date().getHours();
    let label = 'Good morning';
    if (hour >= 12 && hour < 17) label = 'Good afternoon';
    if (hour >= 17) label = 'Good evening';
    greeting.textContent = `${label}, ${data.name}!`;
  }

  if (headerAvatar) {
    headerAvatar.textContent = (data.name || 'U').charAt(0).toUpperCase();
  }
};

window.toggleDarkMode = async function() {
  const isDark = document.getElementById('darkModeToggle').checked;
  setStoredTheme(isDark);
  const u = uid(); if(!u) return;
  await saveSettings(u, { darkMode: isDark });
  showToast(isDark ? '<i class="fa-solid fa-moon"></i> Dark mode on' : '<i class="fa-solid fa-sun"></i> Light mode on');
};

window.clearAllData = function() {
  openConfirm('This will delete ALL your transactions, budgets, and goals. Are you sure?', 'Clear All Data', 'Clear', () => {
    showToast('<i class="fa-solid fa-trash"></i> Data cleared (demo: implement Firestore batch delete)');
  });
};

init();

