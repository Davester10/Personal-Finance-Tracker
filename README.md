# MyFinance v2.0 — Budget Tracker

A modern personal finance tracker built with **Tailwind CSS**, **Firebase v11 Modular SDK**, and **Chart.js**.

## Folder Structure

```
budget-tracker/
├── index.html              # Login / Register page
├── dashboard.html          # Dashboard with summary cards & charts
├── income.html             # Income transactions page
├── expenses.html           # Expense transactions page
├── transactions.html       # All transactions page
├── budget.html             # Budget planning page
├── savings.html            # Savings goals page
├── reports.html            # Reports & analytics page
├── settings.html           # Settings & profile page
├── css/
│   ├── style.css           # Global styles + dark mode overrides
│   ├── dashboard.css       # Dashboard-specific styles
│   └── reports.css         # Reports-specific styles
├── js/
│   ├── firebase-config.js  # Firebase app initialization
│   ├── firebase.js         # Firestore CRUD helpers
│   ├── auth.js             # Firebase Authentication (email + Google)
│   ├── dashboard.js        # Dashboard logic
│   ├── income.js           # Income page logic
│   ├── expenses.js         # Expenses page logic
│   ├── transactions.js     # All transactions logic
│   ├── budget.js           # Budget logic
│   ├── savings.js          # Savings goals logic
│   └── reports.js          # Reports & charts logic
│   └── settings.js         # Settings & profile logic
├── assets/
│   ├── images/
│   └── icons/
├── manifest.json           # PWA manifest
└── service-worker.js       # Offline support
```

## Setup

1. **Create a Firebase project** at [firebase.google.com](https://firebase.google.com)
2. **Enable Authentication** (Email/Password + Google Sign-In)
3. **Create a Firestore database** in test mode
4. **Copy your Firebase config** into `firebase-config.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

5. **Add PWA icons** in `assets/icons/` (192x192 and 512x512 PNGs)
6. **Serve the folder** with any static server (e.g., `npx serve` or VS Code Live Server)

## Features

- Firebase Authentication (Email/Password + Google)
- Firestore cloud database (real-time ready)
- Tailwind CSS modern UI with dark mode
- Responsive sidebar + mobile drawer + bottom nav
- Summary cards, donut charts, bar charts (Chart.js)
- Budget tracking with progress bars
- Savings goals with fund transfers
- Monthly/yearly filtering
- PWA-ready with service worker

## Firestore Security Rules (Start)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
