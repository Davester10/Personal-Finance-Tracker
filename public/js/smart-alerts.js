// js/smart-alerts.js - Smart Alerts, Financial Intelligence & Notification Center (FontAwesome Edition)

class SmartAlertManager {
  constructor() {
    this.container = null;
    this.notifDrawer = null;
    this.notifBadge = null;
    this.notifList = null;
    this.notifications = this.loadNotifications();
    this.undoStack = [];
    this.audioCtx = null;
    this.soundEnabled = localStorage.getItem('mf_sound_enabled') !== 'false';
    this.initDOM();
  }

  loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem('mf_notifications') || '[]');
    } catch {
      return [];
    }
  }

  saveNotifications() {
    try {
      localStorage.setItem('mf_notifications', JSON.stringify(this.notifications.slice(0, 50)));
    } catch (_) { }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    localStorage.setItem('mf_sound_enabled', this.soundEnabled ? 'true' : 'false');
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  // Synthesize pleasant micro-chimes via Web Audio API
  playAudio(type = 'success') {
    if (!this.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx = new AudioContextClass();
      }

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }

      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      if (type === 'success' || type === 'income') {
        // Bright upward chime
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'warning' || type === 'budget_warning') {
        // Warm alert pulse
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(392, now + 0.12); // G4
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'critical' || type === 'over_budget') {
        // Two-tone attention chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc1.frequency.setValueAtTime(523.25, now + 0.14); // C5
        osc2.frequency.setValueAtTime(329.63, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
      } else if (type === 'milestone') {
        // 3-note celebration arpeggio
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          noteGain.gain.setValueAtTime(0.1, now + i * 0.08);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(noteGain);
          noteGain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } else if (type === 'delete') {
        // Soft click-down
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (_) { }
  }

  initDOM() {
    if (typeof document === 'undefined') return;

    // Toast Container
    let container = document.getElementById('smartToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'smartToastContainer';
      document.body.appendChild(container);
    }
    container.className = 'fixed top-4 right-4 sm:top-auto sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-end gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md w-auto sm:w-full pointer-events-none px-0';
    this.container = container;

    // Notification Drawer Backdrop and Panel
    this.ensureNotificationDrawer();
    this.updateNotificationBadge();
  }

  ensureNotificationDrawer() {
    let drawer = document.getElementById('smartNotificationDrawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'smartNotificationDrawer';
      drawer.className = 'fixed inset-0 z-[100] hidden';
      drawer.innerHTML = `
        <div id="smartNotifBackdrop" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity opacity-0"></div>
        <div id="smartNotifPanel" class="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-[101] transform translate-x-full transition-transform duration-300 flex flex-col border-l border-slate-200 dark:border-slate-800">
          <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg">
                <i class="fa-solid fa-bell"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white text-base">Smart Activity & Alerts</h3>
                <p class="text-xs text-slate-400 dark:text-slate-500">Real-time financial notifications</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button id="smartNotifClearBtn" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Clear all">Clear</button>
              <button id="smartNotifCloseBtn" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm transition-colors">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <div id="smartNotifList" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
          <div class="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center">
            <span class="text-xs text-slate-400 flex items-center justify-center gap-1.5"><i class="fa-solid fa-chart-line text-primary-500"></i> Smart Alerts track budget health and milestone progress automatically</span>
          </div>
        </div>
      `;
      document.body.appendChild(drawer);

      document.getElementById('smartNotifBackdrop')?.addEventListener('click', () => this.closeNotificationDrawer());
      document.getElementById('smartNotifCloseBtn')?.addEventListener('click', () => this.closeNotificationDrawer());
      document.getElementById('smartNotifClearBtn')?.addEventListener('click', () => this.clearAllNotifications());
    }

    this.notifDrawer = drawer;
    this.notifList = document.getElementById('smartNotifList');
  }

  openNotificationDrawer() {
    this.ensureNotificationDrawer();
    this.renderNotificationList();
    const drawer = this.notifDrawer;
    const backdrop = document.getElementById('smartNotifBackdrop');
    const panel = document.getElementById('smartNotifPanel');
    if (!drawer || !backdrop || !panel) return;

    drawer.classList.remove('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
      panel.classList.remove('translate-x-full');
      panel.classList.add('translate-x-0');
    });

    // Mark all as read
    this.notifications.forEach(n => n.read = true);
    this.saveNotifications();
    this.updateNotificationBadge();
  }

  closeNotificationDrawer() {
    const backdrop = document.getElementById('smartNotifBackdrop');
    const panel = document.getElementById('smartNotifPanel');
    if (!backdrop || !panel) return;

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
      this.notifDrawer?.classList.add('hidden');
    }, 300);
  }

  updateNotificationBadge() {
    const unreadCount = this.notifications.filter(n => !n.read).length;
    document.querySelectorAll('.smart-notif-badge').forEach(el => {
      if (unreadCount > 0) {
        el.textContent = unreadCount > 9 ? '9+' : unreadCount;
        el.classList.remove('hidden');
        el.classList.add('flex');
      } else {
        el.classList.add('hidden');
        el.classList.remove('flex');
      }
    });
  }

  renderNotificationList() {
    if (!this.notifList) return;
    if (!this.notifications.length) {
      this.notifList.innerHTML = `
        <div class="text-center py-16 px-4">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl">
            <i class="fa-regular fa-bell"></i>
          </div>
          <div class="font-semibold text-slate-800 dark:text-slate-200 text-sm">No notifications yet</div>
          <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Actions you take (expenses, income, budgets, goals) will create smart insights here.</p>
        </div>
      `;
      return;
    }

    const typeIcons = {
      income: { icon: 'fa-arrow-up', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' },
      expense: { icon: 'fa-arrow-down', color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' },
      budget_warning: { icon: 'fa-triangle-exclamation', color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' },
      over_budget: { icon: 'fa-circle-exclamation', color: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' },
      milestone: { icon: 'fa-trophy', color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400' },
      budget: { icon: 'fa-bullseye', color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' },
      savings: { icon: 'fa-piggy-bank', color: 'bg-primary-100 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400' },
      profile: { icon: 'fa-user-check', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
      delete: { icon: 'fa-trash-can', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
      info: { icon: 'fa-circle-info', color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' }
    };

    this.notifList.innerHTML = this.notifications.map((n, idx) => {
      const style = typeIcons[n.type] || typeIcons.info;
      const timeStr = this.formatRelativeTime(n.timestamp);
      return `
        <div class="group relative bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all flex gap-3.5 items-start">
          <div class="w-10 h-10 rounded-xl ${style.color} flex items-center justify-center shrink-0 text-base">
            <i class="fa-solid ${n.icon || style.icon}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <span class="font-bold text-xs text-slate-900 dark:text-white truncate">${n.title}</span>
              <span class="text-[10px] text-slate-400 shrink-0">${timeStr}</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${n.message}</p>
            ${n.badge ? `<span class="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">${n.badge}</span>` : ''}
          </div>
          <button onclick="window.SmartAlerts.removeNotification(${idx})" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs p-1 transition-opacity" title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  removeNotification(index) {
    this.notifications.splice(index, 1);
    this.saveNotifications();
    this.renderNotificationList();
    this.updateNotificationBadge();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.saveNotifications();
    this.renderNotificationList();
    this.updateNotificationBadge();
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  // Display a rich, glassmorphic floating Smart Toast
  show({
    title = 'Action Completed',
    message = '',
    type = 'success',
    icon = 'fa-check',
    badge = '',
    action = null,
    duration = 2500,
    sound = null,
    record = true
  }) {
    this.initDOM();
    if (sound !== false) {
      this.playAudio(sound || type);
    }

    if (record) {
      this.notifications.unshift({
        title,
        message,
        type,
        icon,
        badge,
        timestamp: new Date().toISOString(),
        read: false
      });
      this.saveNotifications();
      this.updateNotificationBadge();
    }

    // Color configurations
    const themeMap = {
      income: {
        border: 'border-emerald-500/30',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60',
        iconBg: 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/25',
        progress: 'bg-emerald-500'
      },
      expense: {
        border: 'border-rose-500/30',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60',
        iconBg: 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-500/25',
        progress: 'bg-rose-500'
      },
      budget_warning: {
        border: 'border-amber-500/40',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60',
        iconBg: 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/25',
        progress: 'bg-amber-500'
      },
      over_budget: {
        border: 'border-red-500/50',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800/60',
        iconBg: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white shadow-red-500/25',
        progress: 'bg-red-600'
      },
      milestone: {
        border: 'border-purple-500/40',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60',
        iconBg: 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-500/25',
        progress: 'bg-purple-600'
      },
      delete: {
        border: 'border-slate-300 dark:border-slate-700',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        iconBg: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white shadow-slate-900/25',
        progress: 'bg-slate-700'
      },
      success: {
        border: 'border-primary-500/30',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400 border border-primary-200 dark:border-primary-800/60',
        iconBg: 'bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-primary-500/25',
        progress: 'bg-primary-600'
      },
      info: {
        border: 'border-blue-500/30',
        bg: 'bg-white/95 dark:bg-slate-900/95',
        badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60',
        iconBg: 'bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-blue-500/25',
        progress: 'bg-blue-600'
      }
    };

    const config = themeMap[type] || themeMap.success;
    const toast = document.createElement('div');
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    toast.id = toastId;
    toast.className = `pointer-events-auto transform -translate-y-4 sm:translate-y-8 opacity-0 transition-all duration-300 ease-out backdrop-blur-xl ${config.bg} ${config.border} border rounded-2xl p-3.5 sm:p-4 shadow-xl shadow-slate-900/10 flex flex-col gap-2 relative overflow-hidden w-full max-w-sm sm:max-w-md`;

    let actionBtnHTML = '';
    if (action && typeof action.onClick === 'function') {
      actionBtnHTML = `
        <button id="${toastId}-action" class="shrink-0 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-1.5">
          <i class="fa-solid fa-rotate-left text-[11px]"></i> ${action.label || 'Undo'}
        </button>
      `;
    }

    toast.innerHTML = `
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0 text-base shadow-md">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="flex-1 min-w-0 pr-1">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <span class="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">${title}</span>
            ${badge ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${config.badgeBg}">${badge}</span>` : ''}
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${message}</p>
        </div>
        ${actionBtnHTML}
        <button id="${toastId}-close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 transition-colors shrink-0">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div id="${toastId}-progress" class="h-full ${config.progress} transition-all duration-[${duration}ms] ease-linear w-full"></div>
      </div>
    `;

    this.container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
      toast.classList.remove('-translate-y-4', 'sm:translate-y-8', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
      const prog = document.getElementById(`${toastId}-progress`);
      if (prog) {
        requestAnimationFrame(() => {
          prog.style.transition = `width ${duration}ms linear`;
          prog.style.width = '0%';
        });
      }
    });

    const removeToast = () => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-4', 'sm:translate-y-4', 'opacity-0');
      setTimeout(() => {
        toast.remove();
      }, 300);
    };

    let timer = setTimeout(removeToast, duration);

    // Close button
    document.getElementById(`${toastId}-close`)?.addEventListener('click', () => {
      clearTimeout(timer);
      removeToast();
    });

    // Action button (e.g. Undo)
    if (action) {
      document.getElementById(`${toastId}-action`)?.addEventListener('click', async (e) => {
        clearTimeout(timer);
        removeToast();
        try {
          await action.onClick(e);
        } catch (err) {
          console.error('Action error:', err);
        }
      });
    }
  }

  // -------------------------------------------------------------
  // Contextual Financial Intelligence & Action Analyzers
  // -------------------------------------------------------------

  notifyIncomeAdded({ amount, desc, category, newBalance, currency = '₦' }) {
    const formatted = currency + Number(amount || 0).toLocaleString('en-NG');
    const balFormatted = currency + Math.max(0, Number(newBalance || 0)).toLocaleString('en-NG');
    this.show({
      title: 'Income Added',
      message: `<strong>+${formatted}</strong> recorded (${desc}). Current balance is <strong>${balFormatted}</strong>.`,
      type: 'income',
      icon: 'fa-arrow-up',
      badge: '<i class="fa-solid fa-arrow-trend-up mr-1"></i> Income Boost',
      sound: 'income'
    });
  }

  notifyExpenseAdded({
    amount,
    desc,
    category,
    spentInCategory,
    budgetLimit,
    newBalance,
    monthlyIncome = 0,
    currency = '₦'
  }) {
    const formatted = currency + Number(amount || 0).toLocaleString('en-NG');
    const spentFormatted = currency + Number(spentInCategory || 0).toLocaleString('en-NG');
    const limitFormatted = budgetLimit ? currency + Number(budgetLimit).toLocaleString('en-NG') : null;
    const balFormatted = currency + Math.max(0, Number(newBalance || 0)).toLocaleString('en-NG');

    // Check if budget exists for category
    if (budgetLimit && budgetLimit > 0) {
      const pct = Math.round((spentInCategory / budgetLimit) * 100);
      if (pct > 100) {
        const overAmt = currency + (spentInCategory - budgetLimit).toLocaleString('en-NG');
        this.show({
          title: `Over Budget Alert: ${category}`,
          message: `-${formatted} on ${desc}. Exceeded ${category} budget by <strong>${overAmt}</strong> (${pct}% of ${limitFormatted}).`,
          type: 'over_budget',
          icon: 'fa-circle-exclamation',
          badge: `<i class="fa-solid fa-triangle-exclamation mr-1"></i> ${pct}% Budget`,
          sound: 'over_budget',
          duration: 4500
        });
        return;
      } else if (pct >= 80) {
        const remAmt = currency + Math.max(0, budgetLimit - spentInCategory).toLocaleString('en-NG');
        this.show({
          title: `Budget Warning: ${category}`,
          message: `-${formatted} on ${desc}. You have used <strong>${pct}%</strong> of your ${category} budget (${remAmt} remaining).`,
          type: 'budget_warning',
          icon: 'fa-triangle-exclamation',
          badge: `<i class="fa-solid fa-triangle-exclamation mr-1"></i> ${pct}% Limit`,
          sound: 'budget_warning',
          duration: 3500
        });
        return;
      }
    }

    // Check low balance warning
    if (monthlyIncome > 0 && newBalance < monthlyIncome * 0.15) {
      this.show({
        title: 'Expense Recorded • Low Balance',
        message: `-${formatted} on ${desc}. Total available balance is now <strong>${balFormatted}</strong>.`,
        type: 'budget_warning',
        icon: 'fa-wallet',
        badge: '<i class="fa-solid fa-wallet mr-1"></i> Low Balance',
        sound: 'warning',
        duration: 3000
      });
      return;
    }

    // Default safe expense
    this.show({
      title: 'Expense Recorded',
      message: `<strong>-${formatted}</strong> recorded for ${desc} (${category}). Available balance: <strong>${balFormatted}</strong>.`,
      type: 'expense',
      icon: 'fa-arrow-down',
      badge: '<i class="fa-solid fa-arrow-down mr-1"></i> Expense',
      sound: 'success'
    });
  }

  notifyTransactionDeleted({ transaction, onUndo, currency = '₦' }) {
    const isIncome = transaction.type === 'income';
    const formatted = currency + Number(transaction.amount || 0).toLocaleString('en-NG');
    this.show({
      title: 'Transaction Deleted',
      message: `Removed ${isIncome ? '+' : '-'}${formatted} (${transaction.desc || transaction.category}).`,
      type: 'delete',
      icon: 'fa-trash-can',
      badge: '<i class="fa-solid fa-trash mr-1"></i> Deleted',
      sound: 'delete',
      duration: 4000,
      action: onUndo ? {
        label: 'Undo',
        onClick: onUndo
      } : null
    });
  }

  notifyTransactionRestored({ transaction, currency = '₦' }) {
    const formatted = currency + Number(transaction.amount || 0).toLocaleString('en-NG');
    this.show({
      title: 'Transaction Restored',
      message: `Restored ${transaction.desc} (${formatted}) to your records.`,
      type: 'success',
      icon: 'fa-rotate-left',
      badge: '<i class="fa-solid fa-rotate-left mr-1"></i> Restored',
      sound: 'success'
    });
  }

  notifyBudgetSet({ category, limit, spentCurrent = 0, currency = '₦' }) {
    const limitFormatted = currency + Number(limit || 0).toLocaleString('en-NG');
    const spentFormatted = currency + Number(spentCurrent || 0).toLocaleString('en-NG');
    const pct = limit > 0 ? Math.round((spentCurrent / limit) * 100) : 0;

    let extraNote = `Current spending is ${spentFormatted} (${pct}%).`;
    if (pct >= 100) {
      extraNote = `Current spending (${spentFormatted}) already exceeds this new budget limit!`;
    }

    this.show({
      title: 'Budget Plan Updated',
      message: `Monthly budget for <strong>${category}</strong> set to <strong>${limitFormatted}</strong>. ${extraNote}`,
      type: pct >= 100 ? 'budget_warning' : 'success',
      icon: 'fa-bullseye',
      badge: `<i class="fa-solid fa-bullseye mr-1"></i> ${category} Budget`,
      sound: pct >= 100 ? 'warning' : 'success'
    });
  }

  notifyBudgetDeleted({ category }) {
    this.show({
      title: 'Budget Removed',
      message: `Budget limit for <strong>${category}</strong> has been removed. Spending is now unconstrained.`,
      type: 'delete',
      icon: 'fa-trash-can',
      badge: '<i class="fa-solid fa-trash mr-1"></i> Removed',
      sound: 'delete'
    });
  }

  notifyGoalCreated({ name, target, saved = 0, currency = '₦' }) {
    const targetFormatted = currency + Number(target || 0).toLocaleString('en-NG');
    this.show({
      title: 'Savings Goal Created',
      message: `Goal <strong>${name}</strong> created with a target of <strong>${targetFormatted}</strong>.`,
      type: 'milestone',
      icon: 'fa-piggy-bank',
      badge: '<i class="fa-solid fa-bullseye mr-1"></i> Goal Created',
      sound: 'milestone'
    });
  }

  notifyFundsAddedToGoal({
    goalName,
    addedAmount,
    newSaved,
    target,
    currency = '₦'
  }) {
    const addedFormatted = currency + Number(addedAmount || 0).toLocaleString('en-NG');
    const savedFormatted = currency + Number(newSaved || 0).toLocaleString('en-NG');
    const targetFormatted = currency + Number(target || 0).toLocaleString('en-NG');
    const pct = target > 0 ? Math.min(Math.round((newSaved / target) * 100), 100) : 0;

    // Milestone checks
    if (pct >= 100) {
      this.show({
        title: 'Goal Completed!',
        message: `You reached 100% of your <strong>${goalName}</strong> goal (${savedFormatted} / ${targetFormatted})!`,
        type: 'milestone',
        icon: 'fa-trophy',
        badge: '<i class="fa-solid fa-trophy mr-1"></i> 100% Complete',
        sound: 'milestone',
        duration: 5000
      });
      return;
    } else if (pct >= 75 && (newSaved - addedAmount) / target < 0.75) {
      this.show({
        title: 'Major Milestone: 75% Reached!',
        message: `+${addedFormatted} added to <strong>${goalName}</strong>. You are at <strong>75%</strong> of your target (${savedFormatted} of ${targetFormatted})!`,
        type: 'milestone',
        icon: 'fa-award',
        badge: '<i class="fa-solid fa-award mr-1"></i> 75% Milestone',
        sound: 'milestone',
        duration: 4000
      });
      return;
    } else if (pct >= 50 && (newSaved - addedAmount) / target < 0.50) {
      this.show({
        title: 'Halfway There: 50% Reached!',
        message: `+${addedFormatted} added to <strong>${goalName}</strong>. You hit <strong>50%</strong> of your target (${savedFormatted} of ${targetFormatted})!`,
        type: 'milestone',
        icon: 'fa-chart-line',
        badge: '<i class="fa-solid fa-chart-line mr-1"></i> 50% Milestone',
        sound: 'milestone',
        duration: 3500
      });
      return;
    }

    this.show({
      title: 'Funds Added to Goal',
      message: `<strong>+${addedFormatted}</strong> transferred to <strong>${goalName}</strong>. Progress: <strong>${pct}%</strong> (${savedFormatted} of ${targetFormatted}).`,
      type: 'milestone',
      icon: 'fa-piggy-bank',
      badge: `<i class="fa-solid fa-piggy-bank mr-1"></i> ${pct}% Saved`,
      sound: 'success'
    });
  }

  notifyGoalDeleted({ name }) {
    this.show({
      title: 'Goal Removed',
      message: `Savings goal <strong>${name}</strong> has been deleted.`,
      type: 'delete',
      icon: 'fa-trash-can',
      badge: '<i class="fa-solid fa-trash mr-1"></i> Deleted',
      sound: 'delete'
    });
  }

  notifyProfileSaved({ name, currency }) {
    this.show({
      title: 'Profile Updated',
      message: `Settings saved for <strong>${name}</strong> with preferred currency <strong>${currency}</strong>.`,
      type: 'success',
      icon: 'fa-user-check',
      badge: '<i class="fa-solid fa-user-check mr-1"></i> Profile Saved',
      sound: 'success'
    });
  }

  notifyThemeToggled(isDark) {
    this.show({
      title: isDark ? 'Dark Mode Enabled' : 'Light Mode Enabled',
      message: isDark ? 'Switched to modern dark slate appearance.' : 'Switched to crisp light mode appearance.',
      type: 'info',
      icon: isDark ? 'fa-moon' : 'fa-sun',
      badge: '<i class="fa-solid fa-circle-half-stroke mr-1"></i> Theme',
      sound: false,
      record: false
    });
  }
}

export const SmartAlerts = new SmartAlertManager();
if (typeof window !== 'undefined') {
  window.SmartAlerts = SmartAlerts;
}
