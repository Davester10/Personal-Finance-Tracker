// js/settings.js
import { initAuth, getCurrentUser, setStoredTheme, getStoredTheme } from "./auth.js";
import { AppState } from "./app-core.js";
import { SmartAlerts } from "./smart-alerts.js";

initAuth();

function getInitialFromName(name = "User") {
  const value = String(name || "User").trim();
  if (!value) return "U";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'U';
}

function initSettingsView() {
  const sessionUser = getCurrentUser();
  const profile = AppState.profile || {};
  const settings = AppState.settings || {};

  const profileName = (profile.name && profile.name !== 'User') ? profile.name : (sessionUser?.name || 'User');
  const profileEmail = (profile.email && profile.email !== '') ? profile.email : (sessionUser?.email || '');

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const phoneEl = document.getElementById('profilePhone');
  const currEl = document.getElementById('profileCurrency');
  const avatarBig = document.getElementById('profileAvatarBig');
  const headerAvatar = document.getElementById('headerAvatar');

  if (nameEl) nameEl.value = profileName;
  if (emailEl) emailEl.value = profileEmail;
  if (phoneEl) phoneEl.value = profile.phone || '';
  if (currEl) currEl.value = profile.currency || '₦';

  const initials = getInitialFromName(profileName);
  if (avatarBig) avatarBig.textContent = initials;
  if (headerAvatar) headerAvatar.textContent = initials;

  const darkToggle = document.getElementById('darkModeToggle');
  if (darkToggle) {
    const storedTheme = getStoredTheme();
    if (storedTheme !== null) {
      darkToggle.checked = storedTheme;
    } else if (settings.darkMode) {
      setStoredTheme(true);
      darkToggle.checked = true;
    }
  }

  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) {
    soundToggle.checked = SmartAlerts.isSoundEnabled();
  }
}

window.initSettingsView = initSettingsView;

window.clearAllData = function() {
  openConfirm('This will remove transactions, budgets, and goals for demo reset. Proceed?', 'Reset Workspace Data', 'Reset', () => {
    AppState.transactions = [];
    AppState.budgets = [];
    AppState.goals = [];
    AppState.emit('state:changed', {});
    SmartAlerts.show({
      title: 'Data Reset',
      message: 'Local financial data cleared for demo session.',
      type: 'delete',
      icon: 'fa-trash-can',
      sound: 'delete'
    });
  });
};

if (AppState.initialized) {
  initSettingsView();
} else {
  AppState.on('initialized', () => initSettingsView());
}
