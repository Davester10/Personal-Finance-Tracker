// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
// FIXED: import getAnalytics instead of duplicate initializeApp import
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBE1nXv-dFR_ZREfhx22J1idKUvN3Q7isw",
  authDomain: "personal-finance-tracker-635ea.firebaseapp.com",
  projectId: "personal-finance-tracker-635ea",
  storageBucket: "personal-finance-tracker-635ea.firebasestorage.app",
  messagingSenderId: "402081545739",
  appId: "1:402081545739:web:b981d935093f8e8a5cd10e",
  measurementId: "G-J1YNY9VYTE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);
