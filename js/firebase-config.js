/*
  =============================================
  firebase-config.js
  =============================================

  PURPOSE:
    This file connects our app to Firebase
    (Google's free cloud database service).

  WHAT FIREBASE GIVES US:
    1. auth → handles who is logged in/out
    2. db   → stores all order data in the cloud

  ⚠️  ACTION REQUIRED — DO THIS FIRST:
  =============================================
  Before the app can work, you must:

  STEP 1: Go to https://console.firebase.google.com
  STEP 2: Click "Add project" → name it "union-tailors"
  STEP 3: On left menu → Build → Authentication
          → Get started → Email/Password → Enable → Save

  STEP 4: On left menu → Build → Firestore Database
          → Create database → Start in TEST MODE → Next → Done

  STEP 5: Go to Project Settings (gear icon ⚙)
          → Your apps → click </> (Web)
          → Register app → name it "union-tailors-web"
          → Copy the firebaseConfig object
          → Paste it below, replacing the placeholder values

  STEP 6: Deploy to Netlify (required for login to work):
          → Go to https://netlify.com → Sign up free
          → "Add new site" → "Deploy manually"
          → Drag your UnionTailors folder into the box
          → You get a URL like https://union-tailors-abc.netlify.app
          → In Firebase Console → Authentication → Settings
            → Authorized domains → Add domain → paste that URL

  AFTER ALL STEPS: The app will fully work!
  =============================================
*/

// ─── IMPORT Firebase tools from Google's CDN ─────────────────
// We use "type=module" in index.html so these imports work.
// Think of these like: "Give me the Firebase tools I need"

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";


// ─── YOUR FIREBASE CONFIG ─────────────────────────────────────
// ⚠️  Replace ALL values below with your own from Firebase Console
// ⚠️  Do NOT share this file publicly (keep it private)

const firebaseConfig = {
  apiKey: "AIzaSyAGCxnK7XjrSuLzaoXQ_vNLuE1-gpEIIUo",
  authDomain: "union-tailors.firebaseapp.com",
  projectId: "union-tailors",
  storageBucket: "union-tailors.firebasestorage.app",
  messagingSenderId: "85541805300",
  appId: "1:85541805300:web:8400b30aaa77bbf01052a1",
  measurementId: "G-DY48WVWMBD"
};


// ─── CHECK IF CONFIG IS FILLED IN ────────────────────────────
// If the user hasn't replaced the placeholder, we know Firebase
// is not configured yet. Other files check this before using Firebase.

export const IS_CONFIGURED = true;


// ─── INITIALIZE FIREBASE ──────────────────────────────────────
// This is like "logging in" to Firebase with our config.
// We only do this once here, then share it with other files.

const app = initializeApp(firebaseConfig);


// ─── CREATE SERVICE OBJECTS ──────────────────────────────────
// auth → the authentication service (who is logged in)
// db   → the Firestore database service (where data lives)

const auth = getAuth(app);
const db   = getFirestore(app);


// ─── EXPORT so other files can use auth and db ───────────────
// auth.js and db.js will import these
export { auth, db };
