/*
  =============================================
  app.js
  =============================================

  PURPOSE:
    This is the BRAIN of the app.
    It ties together ALL other files.
    It is the only file that:
      - Manages state (what data the app has)
      - Handles events (what happens when you click)
      - Decides what screen to show
      - Calls auth.js to login/logout
      - Calls db.js to save/load data
      - Calls ui.js to build HTML for each screen

  HOW DATA FLOWS THROUGH THE APP:

    User clicks "Save Order"
          ↓
    app.js handleClick() fires
          ↓
    app.js reads form → validates → saves to state.form
          ↓
    app.js calls db.js → saveOrder() → writes to Firebase
          ↓
    Firebase updates Firestore
          ↓
    Firebase triggers onSnapshot (in db.js)
          ↓
    db.js calls our callback → updates state.orders
          ↓
    app.js calls render()
          ↓
    ui.js builds the HTML
          ↓
    app.js puts it into #app → screen updates

  ─────────────────────────────────────────────
  HOW TO READ THIS FILE:
    1. Start at the bottom → init() starts everything
    2. init() calls onAuthChange() → determines login state
    3. If logged in → render() shows order list
    4. User interactions hit handleClick() / handleInput()
    5. Those functions update state and call render() again
  ─────────────────────────────────────────────
*/

// ─── IMPORTS ─────────────────────────────────────────────────
// We import exactly what we need from each file

import { IS_CONFIGURED }                          from './firebase-config.js';
import { createAccount, loginUser, logoutUser, onAuthChange } from './auth.js';
import { listenToOrders, saveOrder, editOrder, removeOrder, getNextOrderNumber } from './db.js';
import {
  setupScreen, loginScreen, listScreen, formScreen,
  detailScreen, printScreen,
  STATUS, GARMENTS, calcTotal, calcBalance, fmtDate
} from './ui.js';


// ─── STATE ───────────────────────────────────────────────────
/*
  "State" is the app's memory — all the data the app needs right now.
  Every time state changes, we call render() to update the screen.
  This pattern (state → render) is the same idea React/Vue use.
*/
const state = {
  // Auth
  user:           null,      // Firebase user object (null = not logged in)
  loginTab:       'login',   // Which login tab is active: 'login' or 'signup'
  authError:      null,      // Error message for login screen

  // Navigation
  view:           'loading', // Current screen: loading | list | form | detail | print | setup
  loading:        false,     // Shows loading state on buttons

  // Order data (loaded from Firebase)
  orders:         [],        // All orders array
  unsubscribe:    null,      // Firebase listener cleanup function

  // List screen
  statusFilter:   'All',     // Which status to show in list
  searchQuery:    '',        // Current search text

  // Selected order (for detail/print screens)
  selectedOrder:  null,      // The order being viewed

  // Form screen
  form:           null,      // Order data being created/edited
  formTab:        'details', // Which form tab: 'details' or 'measurements'
  repeatCustomer: null,      // Previous order by same phone (for measurement copy)
  isEditingExisting: false,  // true = editing, false = new order
};


// ─── RENDER ──────────────────────────────────────────────────
/*
  render() is called every time state changes.
  It looks at state.view and puts the correct HTML into #app.

  This is the only place we write to the DOM directly.
  Everything else just updates state and calls render().
*/
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  switch (state.view) {

    case 'loading':
      app.innerHTML = `
        <div class="loading-screen">
          <div class="spinner"></div>
          <p>Loading Union Tailors...</p>
        </div>
      `;
      break;

    case 'setup':
      app.innerHTML = setupScreen();
      break;

    case 'login':
      app.innerHTML = loginScreen(state.loginTab, state.authError);
      break;

    case 'list':
      app.innerHTML = listScreen(
        state.orders,
        state.statusFilter,
        state.searchQuery,
        state.user
      );
      // After render, focus the search box if it has a value
      const searchEl = document.getElementById('search-input');
      if (searchEl && state.searchQuery) searchEl.focus();
      break;

    case 'form':
      app.innerHTML = formScreen(
        state.form,
        state.isEditingExisting,
        state.formTab,
        state.repeatCustomer
      );
      break;

    case 'detail':
      app.innerHTML = detailScreen(state.selectedOrder);
      break;

    case 'print':
      app.innerHTML = printScreen(state.selectedOrder);
      break;
  }
}


// ─── SAVE FORM STATE FROM DOM ─────────────────────────────────
/*
  Before any action that triggers a re-render (like switching tabs,
  adding a garment), we save all current form input values into state.form.

  Why? Because setting innerHTML wipes the DOM completely.
  If we don't save first, the user's typed values are lost.
*/
function saveFormFromDOM() {
  if (state.view !== 'form' || !state.form) return;

  // Save simple fields (customerName, customerPhone, dates, status, advance)
  document.querySelectorAll('[data-field]').forEach(el => {
    state.form[el.dataset.field] = el.value;
  });

  // Save garment fields (type, price, details for each garment row)
  document.querySelectorAll('[data-garment]').forEach(el => {
    const index = parseInt(el.dataset.garment);
    const field = el.dataset.garmentField;
    if (state.form.garments[index] !== undefined) {
      state.form.garments[index][field] = el.value;
    }
  });

  // Save measurement fields (upper and lower body)
  document.querySelectorAll('[data-measure]').forEach(el => {
    const section = el.dataset.measure;       // 'upper' or 'lower'
    const field   = el.dataset.measureField;
    if (state.form.measurements[section]) {
      state.form.measurements[section][field] = el.value;
    }
  });

  // Save notes textarea
  const notesEl = document.querySelector('[data-measure-notes]');
  if (notesEl) state.form.measurements.notes = notesEl.value;
}


// ─── CREATE EMPTY ORDER FORM ──────────────────────────────────
/*
  Returns a blank order object with all required fields.
  Used when starting a new order.
*/
function emptyOrder(orderNumber) {
  const today = new Date().toISOString().split('T')[0]; // "2025-04-13"

  return {
    orderNumber,
    customerName:  '',
    customerPhone: '',
    bookingDate:   today,
    trialDate:     '',
    deliveryDate:  '',
    garments:      [{ type: 'Shirt', details: '', price: '' }],
    measurements: {
      upper: { length:'', chest:'', waist:'', hip:'', shoulder:'', sleeve:'', collar:'' },
      lower: { length:'', waist:'', hip:'', thigh:'', bottom:'', inseam:'' },
      notes: ''
    },
    advance: '',
    status:  'Pending'
  };
}


// ─── FIND ORDER BY FIRESTOREИД ────────────────────────────────
// Helper: find an order object from state.orders by its firestoreId
function findOrder(firestoreId) {
  return state.orders.find(o => o.firestoreId === firestoreId);
}

// Helper: find most recent previous order for same phone number
function findRepeatCustomer(phone, currentOrderNumber) {
  if (!phone || phone.length < 8) return null;
  return state.orders
    .filter(o => o.customerPhone === phone && o.orderNumber !== currentOrderNumber)
    .sort((a, b) => b.orderNumber - a.orderNumber)[0] || null;
}


// ─── EVENT: CLICK HANDLER ────────────────────────────────────
/*
  Instead of adding individual click listeners to every button,
  we use "event delegation" — one listener on the whole app.

  When any element is clicked, we check its data-action attribute
  to know what to do.

  This is more efficient and works even after innerHTML is replaced.
*/
async function handleClick(e) {
  // Find the closest element with a data-action (handles clicking on child elements)
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  // ── AUTH ACTIONS ─────────────────────────────────────────
  if (action === 'login') {
    await doLogin();
    return;
  }

  if (action === 'signup') {
    await doSignup();
    return;
  }

  if (action === 'logout') {
    if (!confirm('Log out of Union Tailors?')) return;
    // Stop listening to Firestore before logging out
    if (state.unsubscribe) state.unsubscribe();
    await logoutUser();
    state.orders = [];
    state.view   = 'login';
    render();
    return;
  }

  if (action === 'switch-tab') {
    // Switch between Login and Sign Up tabs
    state.loginTab  = target.dataset.tab;
    state.authError = null;
    render();
    return;
  }

  // ── LIST SCREEN ACTIONS ──────────────────────────────────
  if (action === 'new-order') {
    const orderNumber = await getNextOrderNumber(state.user.uid);
    state.form               = emptyOrder(orderNumber);
    state.formTab            = 'details';
    state.repeatCustomer     = null;
    state.isEditingExisting  = false;
    state.view               = 'form';
    render();
    return;
  }

  if (action === 'open-order') {
    const order = findOrder(target.dataset.id);
    if (!order) return;
    state.selectedOrder = order;
    state.view          = 'detail';
    render();
    return;
  }

  // ── FORM ACTIONS ─────────────────────────────────────────
  if (action === 'switch-form-tab') {
    saveFormFromDOM();           // ← Save current input values first!
    state.formTab = target.dataset.tab;
    render();
    return;
  }

  if (action === 'cancel-form') {
    state.view = 'list';
    render();
    return;
  }

  if (action === 'add-garment') {
    saveFormFromDOM();
    state.form.garments.push({ type: 'Shirt', details: '', price: '' });
    render();
    return;
  }

  if (action === 'remove-garment') {
    saveFormFromDOM();
    const index = parseInt(target.dataset.index);
    state.form.garments.splice(index, 1);
    render();
    return;
  }

  if (action === 'copy-measurements') {
    // Copy measurements from the repeat customer's last order into this form
    if (!state.repeatCustomer) return;
    saveFormFromDOM();
    // Deep copy so we don't accidentally modify the old order
    state.form.measurements = JSON.parse(JSON.stringify(state.repeatCustomer.measurements));
    alert(`Measurements copied from order #${state.repeatCustomer.orderNumber}!`);
    render();
    return;
  }

  if (action === 'save-order') {
    await doSaveOrder();
    return;
  }

  // ── DETAIL SCREEN ACTIONS ────────────────────────────────
  if (action === 'back-to-list') {
    state.view = 'list';
    render();
    return;
  }

  if (action === 'back-to-detail') {
    state.view = 'detail';
    render();
    return;
  }

  if (action === 'edit-order') {
    const order = findOrder(target.dataset.id);
    if (!order) return;
    // Deep copy so form changes don't affect the original until saved
    state.form              = JSON.parse(JSON.stringify(order));
    state.formTab           = 'details';
    state.isEditingExisting = true;
    state.repeatCustomer    = null;
    state.view              = 'form';
    render();
    return;
  }

  if (action === 'advance-status') {
    // Move order to the next status (e.g. Pending → Cutting)
    const order  = findOrder(target.dataset.id);
    if (!order) return;
    const cfg    = STATUS[order.status];
    if (!cfg?.next) return;
    const updated = { ...order, status: cfg.next };
    await editOrder(state.user.uid, order.firestoreId, { status: cfg.next });
    // Update in state immediately (Firebase will also sync)
    state.selectedOrder = updated;
    state.orders = state.orders.map(o => o.firestoreId === order.firestoreId ? updated : o);
    render();
    return;
  }

  if (action === 'print-order') {
    state.view = 'print';
    render();
    return;
  }

  if (action === 'whatsapp') {
    const order = state.selectedOrder;
    if (!order?.customerPhone) return;
    const balance = calcBalance(order);
    const msg = `Hello ${order.customerName},\n\nYour order #${order.orderNumber} at *Union Tailors* is now *${order.status}*.\n\n📅 Delivery: ${fmtDate(order.deliveryDate)}\n💰 Balance due: ₹${balance}\n\n– Union Tailors, Shiv Chowk, Muzaffarnagar\n📞 9997545277`;
    window.open('https://wa.me/91' + order.customerPhone + '?text=' + encodeURIComponent(msg));
    return;
  }

  if (action === 'delete-order') {
    if (!confirm('Delete this order permanently? This cannot be undone.')) return;
    const order = findOrder(target.dataset.id);
    if (!order) return;
    await removeOrder(state.user.uid, order.firestoreId);
    state.view = 'list';
    render();
    return;
  }
}


// ─── EVENT: INPUT / CHANGE HANDLER ───────────────────────────
/*
  Handles typing in input fields and selecting dropdowns.
  We don't re-render on every keystroke — that would reset the cursor.
  Instead, we only update live displays (total, balance).
  State is saved properly in saveFormFromDOM() before critical actions.
*/
function handleInputChange(e) {
  const action = e.target.dataset.action;

  // Search input on the list screen
  if (action === 'search') {
    state.searchQuery = e.target.value;
    render();
    return;
  }

  // Status filter dropdown on the list screen
  if (action === 'filter-status') {
    state.statusFilter = e.target.value;
    render();
    return;
  }

  // Phone number field — check for repeat customer as user types
  if (action === 'check-repeat') {
    const phone = e.target.value;
    state.repeatCustomer = findRepeatCustomer(phone, state.form?.orderNumber);
    // Update just the phone field in state without full re-render
    if (state.form) state.form.customerPhone = phone;
    // Only re-render if repeat customer status changed
    // (to show/hide the "Copy measurements" banner)
    const wasRepeat = !!document.querySelector('.repeat-customer-alert');
    const isRepeat  = !!state.repeatCustomer;
    if (wasRepeat !== isRepeat) render();
    return;
  }

  // Price or advance changed — update total & balance display without full re-render
  const garmentField = e.target.dataset.garmentField;
  if (garmentField === 'price' || e.target.dataset.field === 'advance') {
    // Temporarily save to state to get correct totals
    const garmentIndex = e.target.dataset.garment;
    if (garmentIndex !== undefined && state.form?.garments[parseInt(garmentIndex)]) {
      state.form.garments[parseInt(garmentIndex)].price = e.target.value;
    }
    if (e.target.dataset.field === 'advance') {
      state.form.advance = e.target.value;
    }
    // Update totals display directly (faster than full re-render)
    const totalEl   = document.getElementById('form-total');
    const balanceEl = document.getElementById('form-balance');
    if (totalEl)   totalEl.textContent   = '₹' + calcTotal(state.form);
    if (balanceEl) balanceEl.textContent = 'Balance: ₹' + calcBalance(state.form);
    return;
  }
}


// ─── AUTH: DO LOGIN ──────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;

  if (!email || !password) {
    state.authError = 'Please enter your email and password.';
    render();
    return;
  }

  // Show loading
  state.loading = true;
  const btn = document.querySelector('[data-action="login"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  const result = await loginUser(email, password);
  state.loading = false;

  if (!result.success) {
    state.authError = result.error;
    render();
  }
  // If success: onAuthChange fires automatically → sets state.user → render()
}


// ─── AUTH: DO SIGNUP ─────────────────────────────────────────
async function doSignup() {
  const name     = document.getElementById('auth-name')?.value?.trim();
  const email    = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;

  if (!email || !password) {
    state.authError = 'Please enter your email and password.';
    render();
    return;
  }

  if (password.length < 6) {
    state.authError = 'Password must be at least 6 characters.';
    render();
    return;
  }

  const btn = document.querySelector('[data-action="signup"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }

  const result = await createAccount(email, password, name || 'Union Tailors');

  if (!result.success) {
    state.authError = result.error;
    render();
  }
  // If success: onAuthChange fires automatically
}


// ─── FORM: SAVE ORDER ────────────────────────────────────────
async function doSaveOrder() {
  // Step 1: Save all current input values into state.form
  saveFormFromDOM();

  // Step 2: Validate required fields
  if (!state.form.customerName?.trim()) {
    alert('Please enter the customer name.');
    return;
  }
  if (!state.form.bookingDate) {
    alert('Please select a booking date.');
    return;
  }

  // Step 3: Show loading on button
  const btn = document.querySelector('[data-action="save-order"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  // Step 4: Save to Firebase
  let result;
  if (state.isEditingExisting) {
    // Update existing order in Firestore
    // We don't update firestoreId or orderNumber — they never change
    const { firestoreId, ...dataToUpdate } = state.form;
    result = await editOrder(state.user.uid, state.form.firestoreId, dataToUpdate);
  } else {
    // Save new order to Firestore
    result = await saveOrder(state.user.uid, state.form);
  }

  if (!result.success) {
    alert('Error: ' + result.error);
    if (btn) { btn.disabled = false; btn.textContent = 'Save Order #' + state.form.orderNumber; }
    return;
  }

  // Step 5: Go back to list
  // Firebase's onSnapshot will automatically add the new order to state.orders
  state.view = 'list';
  render();
}


// ─── START THE APP ────────────────────────────────────────────
/*
  init() is called once when the page loads.
  Everything starts here.
*/
function init() {

  // Step 1: Check if Firebase is configured
  if (!IS_CONFIGURED) {
    state.view = 'setup';
    render();
    return;
  }

  // Step 2: Show loading while we check auth state
  state.view = 'loading';
  render();

  // Step 3: Listen for auth state changes
  // This fires immediately with the current state, then again on every change.
  // Firebase remembers login across sessions — no need to log in every time.
  onAuthChange((user) => {
    if (user) {
      // ── USER IS LOGGED IN ────────────────────────
      state.user = user;
      state.view = 'list';

      // Stop any existing Firestore listener (in case of re-login)
      if (state.unsubscribe) state.unsubscribe();

      // Start listening to this user's orders in real-time
      // listenToOrders returns the unsubscribe function
      state.unsubscribe = listenToOrders(user.uid, (orders) => {
        // This fires every time any order is added/changed/deleted
        state.orders = orders;

        // If we're on the detail screen, keep the selected order fresh
        if (state.view === 'detail' && state.selectedOrder) {
          const fresh = state.orders.find(o => o.firestoreId === state.selectedOrder.firestoreId);
          if (fresh) state.selectedOrder = fresh;
        }

        render();
      });

    } else {
      // ── USER IS LOGGED OUT ───────────────────────
      state.user   = null;
      state.orders = [];
      state.view   = 'login';

      // Stop Firestore listener when logged out
      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      render();
    }
  });

  // Step 4: Set up event delegation on the #app container
  // ONE listener for ALL clicks (more efficient than individual listeners)
  const app = document.getElementById('app');
  app.addEventListener('click',  handleClick);
  app.addEventListener('input',  handleInputChange);
  app.addEventListener('change', handleInputChange);
}


// ─── ENTRY POINT ─────────────────────────────────────────────
// Start the app when the page is ready.
// "DOMContentLoaded" fires when HTML is parsed (before images load).
document.addEventListener('DOMContentLoaded', init);
