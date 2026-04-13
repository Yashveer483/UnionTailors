/*
  =============================================
  auth.js
  =============================================

  PURPOSE:
    Handles everything related to WHO is using the app.
    Login, Signup, and Logout.

  FUNCTIONS EXPORTED (used in app.js):
    createAccount(email, password)  → creates a new user
    loginUser(email, password)      → signs in existing user
    logoutUser()                    → signs out current user
    onAuthChange(callback)          → fires whenever login state changes

  HOW FIREBASE AUTH WORKS:
    Firebase keeps track of who is logged in.
    When you call loginUser(), Firebase checks the email+password.
    If correct, it saves the "logged in" state in the browser.
    Next time the app opens, Firebase remembers — user is still logged in.
    This is why you don't have to log in every time you open the app.

  DATA FLOW:
    User types email + password
         ↓
    auth.js calls Firebase Auth
         ↓
    Firebase checks credentials on their servers
         ↓
    Returns: user object (if success) or error (if failed)
         ↓
    app.js receives result and shows correct screen
*/

// ─── IMPORT auth from our firebase setup ─────────────────────
import { auth } from './firebase-config.js';

// ─── IMPORT specific Auth functions from Firebase SDK ────────
import {
  createUserWithEmailAndPassword,  // Creates new account
  signInWithEmailAndPassword,       // Signs in existing account
  signOut,                          // Signs out current user
  onAuthStateChanged,               // Listens for login/logout events
  updateProfile                     // Updates display name
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";


// ─── ERROR MESSAGES ──────────────────────────────────────────
// Firebase returns error codes like "auth/wrong-password"
// which are confusing. We translate them into plain English.

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'This email is already registered. Please login instead.',
  'auth/wrong-password':       'Incorrect password. Please try again.',
  'auth/user-not-found':       'No account found with this email. Please sign up.',
  'auth/weak-password':        'Password must be at least 6 characters long.',
  'auth/invalid-email':        'Please enter a valid email address.',
  'auth/too-many-requests':    'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  'auth/invalid-credential':   'Email or password is incorrect. Please try again.'
};

// Helper function: convert Firebase error code to plain English
function getErrorMessage(error) {
  return ERROR_MESSAGES[error.code] || 'Something went wrong. Please try again.';
}


// ─── FUNCTION 1: CREATE ACCOUNT (Sign Up) ────────────────────
/*
  What it does:
    Creates a new Firebase user with email and password.
    Also saves the shop name as the user's display name.

  Parameters:
    email    → e.g. "uniontailors@gmail.com"
    password → e.g. "mypassword123"
    name     → e.g. "Union Tailors"

  Returns:
    { success: true, user: {...} }    on success
    { success: false, error: "..." } on failure
*/
export async function createAccount(email, password, name) {
  try {
    // Ask Firebase to create the account
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Save the name so we can show it in the header
    if (name) {
      await updateProfile(result.user, { displayName: name });
    }

    return { success: true, user: result.user };

  } catch (error) {
    // If anything went wrong, return the error in plain English
    return { success: false, error: getErrorMessage(error) };
  }
}


// ─── FUNCTION 2: LOGIN (Sign In) ─────────────────────────────
/*
  What it does:
    Checks email + password against Firebase.
    If correct, Firebase marks the user as "logged in".
    The browser remembers this — no login needed next time.

  Parameters:
    email    → registered email
    password → the password

  Returns:
    { success: true, user: {...} }    on success
    { success: false, error: "..." } on failure
*/
export async function loginUser(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };

  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}


// ─── FUNCTION 3: LOGOUT ──────────────────────────────────────
/*
  What it does:
    Signs out the current user from Firebase.
    After this, auth.currentUser will be null.
    The app will show the login screen.
*/
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}


// ─── FUNCTION 4: LISTEN FOR AUTH CHANGES ─────────────────────
/*
  What it does:
    This is the most important auth function.
    It calls your callback function IMMEDIATELY with the current
    login state, and then calls it AGAIN whenever it changes.

    Example:
      onAuthChange((user) => {
        if (user) {
          console.log("Logged in as:", user.email);
          // Show order list
        } else {
          console.log("Not logged in");
          // Show login screen
        }
      });

  This is how the app knows which screen to show when it opens.
  Instead of checking once, it LISTENS continuously.

  Parameters:
    callback → a function that receives the user object (or null)

  Returns:
    An "unsubscribe" function — call it to stop listening.
    (We use this when the component unmounts to prevent memory leaks)
*/
export function onAuthChange(callback) {
  // onAuthStateChanged returns an unsubscribe function
  return onAuthStateChanged(auth, callback);
}
