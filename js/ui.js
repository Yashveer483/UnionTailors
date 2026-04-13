/*
  =============================================
  ui.js
  =============================================

  PURPOSE:
    This file ONLY builds HTML strings.
    It does NOT handle clicks, save data, or talk to Firebase.
    Think of it as a "painter" — it draws the screens.

  HOW IT WORKS:
    Each function returns an HTML string.
    app.js puts that string into document.getElementById('app').innerHTML.
    The screen changes instantly.

  FUNCTIONS EXPORTED (used in app.js):
    setupScreen()                           → "Configure Firebase" screen
    loginScreen(tab, error)                 → Login / Signup form
    listScreen(orders, filter, search, user) → Main order list
    formScreen(form, isEdit, tab, repeatCustomer) → New/Edit order
    detailScreen(order)                     → View one order
    printScreen(order)                      → Printable slip

  IMPORTANT RULE:
    These functions ONLY return HTML strings.
    They never call Firebase, never change state.
    All logic is in app.js.
*/

// ─── CONSTANTS ───────────────────────────────────────────────

export const GARMENTS = [
  'Shirt', 'Pant', 'Kurta', 'Coat', 'Blazer',
  'Jacket', 'Sherwani', 'Suit (Full)', 'Salwar Kameez', 'Other'
];

// Status configuration: colors and what comes next
export const STATUS = {
  'Pending':   { bg: '#FEF3C7', color: '#92400E', next: 'Cutting'   },
  'Cutting':   { bg: '#FFEDD5', color: '#9A3412', next: 'Stitching' },
  'Stitching': { bg: '#DBEAFE', color: '#1E40AF', next: 'Trial'     },
  'Trial':     { bg: '#EDE9FE', color: '#5B21B6', next: 'Ready'     },
  'Ready':     { bg: '#D1FAE5', color: '#065F46', next: 'Delivered' },
  'Delivered': { bg: '#F1F5F9', color: '#475569', next: null        }
};


// ─── HELPER FUNCTIONS ─────────────────────────────────────────

// Format a date string "2025-04-13" → "13 Apr 25"
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit'
  });
}

// Add up all garment prices for an order
export function calcTotal(order) {
  return (order.garments || []).reduce((sum, g) => sum + (parseFloat(g.price) || 0), 0);
}

// Calculate how much the customer still owes
export function calcBalance(order) {
  return calcTotal(order) - (parseFloat(order.advance) || 0);
}

// Build a colored status badge HTML
function statusBadge(status) {
  const s = STATUS[status] || STATUS['Pending'];
  return `<span class="badge" style="background:${s.bg};color:${s.color}">${status}</span>`;
}

// Build garment type <option> tags for a <select>
function garmentOptions(selected) {
  return GARMENTS.map(g =>
    `<option value="${g}" ${g === selected ? 'selected' : ''}>${g}</option>`
  ).join('');
}

// Build status <option> tags for a <select>
function statusOptions(selected) {
  return Object.keys(STATUS).map(s =>
    `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`
  ).join('');
}


// ─── SCREEN 1: SETUP SCREEN ──────────────────────────────────
/*
  Shown when Firebase is not configured yet.
  Gives step-by-step instructions to set up Firebase.
*/
export function setupScreen() {
  return `
    <div class="setup-page">
      <div style="padding:20px 0 10px">
        <h2>⚙️ Setup Required</h2>
        <p style="color:#888;font-size:14px;margin-top:6px">
          Before using the app, connect it to Firebase (Google's free cloud database).
          This takes about 10 minutes and is done only once.
        </p>
      </div>

      <div class="setup-steps">

        <div class="setup-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Create a Firebase Project</h4>
            <p>Go to <a href="https://console.firebase.google.com" target="_blank">console.firebase.google.com</a>
            → Add project → Name it "union-tailors" → Continue → Create</p>
          </div>
        </div>

        <div class="setup-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Enable Email Login</h4>
            <p>Left menu → Build → Authentication → Get started
            → Email/Password → Enable → Save</p>
          </div>
        </div>

        <div class="setup-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Create the Database</h4>
            <p>Left menu → Build → Firestore Database
            → Create database → Start in TEST MODE → Next → Done</p>
          </div>
        </div>

        <div class="setup-step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h4>Get Your Config</h4>
            <p>Project Settings (⚙) → Your apps → Web app (&lt;/&gt;)
            → Register → Copy the firebaseConfig object</p>
          </div>
        </div>

        <div class="setup-step">
          <div class="step-number">5</div>
          <div class="step-content">
            <h4>Paste Config in firebase-config.js</h4>
            <p>Open <strong>js/firebase-config.js</strong> in a text editor.
            Replace the placeholder values with your copied config.</p>
          </div>
        </div>

        <div class="setup-step">
          <div class="step-number">6</div>
          <div class="step-content">
            <h4>Deploy to Netlify (Free)</h4>
            <p>Go to <a href="https://netlify.com" target="_blank">netlify.com</a>
            → Sign up → Add new site → Deploy manually
            → Drag the entire UnionTailors folder → Done!</p>
            <p style="margin-top:6px">Then in Firebase → Authentication → Settings → Authorized domains → Add your Netlify URL</p>
          </div>
        </div>

      </div>

      <p style="font-size:12px;color:#aaa;text-align:center;padding-bottom:20px">
        After setup, reopen the app — login screen will appear.
      </p>
    </div>
  `;
}


// ─── SCREEN 2: LOGIN SCREEN ───────────────────────────────────
/*
  Shown when no user is logged in.
  Has two tabs: Login and Sign Up.

  Parameters:
    tab   → 'login' or 'signup' (which tab is active)
    error → error message to display (or null)
*/
export function loginScreen(tab = 'login', error = null) {
  return `
    <div class="login-page">

      <div class="login-logo">
        <h1>✂ Union Tailors</h1>
        <p>8-Gol Market, Shiv Chowk, Muzaffarnagar</p>
      </div>

      <div class="login-card">

        <!-- Tab switcher: Login | Sign Up -->
        <div class="login-tabs">
          <button
            class="login-tab ${tab === 'login' ? 'active' : ''}"
            data-action="switch-tab"
            data-tab="login">
            Login
          </button>
          <button
            class="login-tab ${tab === 'signup' ? 'active' : ''}"
            data-action="switch-tab"
            data-tab="signup">
            Sign Up
          </button>
        </div>

        <!-- Sign Up form (hidden when Login tab is active) -->
        ${tab === 'signup' ? `
          <div class="form-group">
            <label>Shop Name</label>
            <input type="text" id="auth-name" placeholder="e.g. Union Tailors" />
          </div>
        ` : ''}

        <!-- Common fields -->
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="auth-email" placeholder="your@email.com" autocomplete="email" />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" id="auth-password" placeholder="••••••••" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" />
        </div>

        <!-- Error message (shown only if there's an error) -->
        ${error ? `<div class="error-msg">${error}</div>` : ''}

        <!-- Submit button -->
        <button
          class="btn btn-primary btn-block"
          style="margin-top:16px"
          data-action="${tab === 'login' ? 'login' : 'signup'}">
          ${tab === 'login' ? 'Login' : 'Create Account'}
        </button>

      </div>
    </div>
  `;
}


// ─── SCREEN 3: ORDER LIST ─────────────────────────────────────
/*
  The main screen — shows all orders, stats, and search.

  Parameters:
    orders       → array of order objects from Firestore
    statusFilter → which status to show ('All', 'Pending', 'Ready', etc.)
    search       → current search text
    user         → Firebase user object (for display name and logout)
*/
export function listScreen(orders, statusFilter, search, user) {
  // Calculate stats for the top bar
  const total    = orders.length;
  const working  = orders.filter(o => ['Pending','Cutting','Stitching','Trial'].includes(o.status)).length;
  const ready    = orders.filter(o => o.status === 'Ready').length;
  const revenue  = orders.reduce((sum, o) => sum + calcTotal(o), 0);

  // Filter orders based on search text and status dropdown
  const filtered = orders.filter(o => {
    const matchSearch = !search
      || o.customerName?.toLowerCase().includes(search.toLowerCase())
      || String(o.orderNumber).includes(search)
      || (o.customerPhone || '').includes(search);

    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return `
    <!-- Header bar -->
    <div class="header">
      <div class="header-title">
        <h1>Union Tailors</h1>
        <p>Shiv Chowk, Muzaffarnagar</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="header-btn" data-action="new-order">+ New Order</button>
        <button class="back-btn" data-action="logout" title="Logout">⏻</button>
      </div>
    </div>

    <!-- Stats bar: Total, Working, Ready, Revenue -->
    <div class="stats-bar">
      <div class="stat-cell">
        <div class="stat-value" style="color:#1a1a1a">${total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color:#e67e22">${working}</div>
        <div class="stat-label">Working</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color:#16a34a">${ready}</div>
        <div class="stat-label">Ready</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color:#8B1A1A">₹${revenue}</div>
        <div class="stat-label">Revenue</div>
      </div>
    </div>

    <!-- Search box and status filter -->
    <div class="search-bar">
      <input
        type="search"
        id="search-input"
        placeholder="Search name, order #, phone..."
        value="${search}"
        data-action="search"
      />
      <select data-action="filter-status">
        <option value="All"       ${statusFilter === 'All'       ? 'selected' : ''}>All</option>
        <option value="Pending"   ${statusFilter === 'Pending'   ? 'selected' : ''}>Pending</option>
        <option value="Cutting"   ${statusFilter === 'Cutting'   ? 'selected' : ''}>Cutting</option>
        <option value="Stitching" ${statusFilter === 'Stitching' ? 'selected' : ''}>Stitching</option>
        <option value="Trial"     ${statusFilter === 'Trial'     ? 'selected' : ''}>Trial</option>
        <option value="Ready"     ${statusFilter === 'Ready'     ? 'selected' : ''}>Ready</option>
        <option value="Delivered" ${statusFilter === 'Delivered' ? 'selected' : ''}>Delivered</option>
      </select>
    </div>

    <!-- Orders list -->
    <div class="orders-list">
      ${filtered.length === 0 ? emptyState(orders.length) : filtered.map(orderCard).join('')}
    </div>
  `;
}

// Helper: renders a single order card for the list
function orderCard(order) {
  const total   = calcTotal(order);
  const balance = calcBalance(order);
  const gNames  = (order.garments || []).map(g => g.type).join(', ');

  return `
    <div class="order-card" data-action="open-order" data-id="${order.firestoreId}">
      <div class="card-body">
        <div class="card-top">
          <div>
            <div class="card-name">${order.customerName || '—'}</div>
            <div class="card-meta">#${order.orderNumber} · ${fmtDate(order.bookingDate)}</div>
          </div>
          <div class="card-amount">
            <div class="card-total">₹${total}</div>
            ${balance > 0 ? `<div class="card-due">₹${balance} due</div>` : ''}
          </div>
        </div>
        <div class="card-bottom">
          <div class="card-garments">${gNames}${order.deliveryDate ? ' · ' + fmtDate(order.deliveryDate) : ''}</div>
          ${statusBadge(order.status)}
        </div>
      </div>
    </div>
  `;
}

// Helper: empty state when no orders exist or none match search
function emptyState(total) {
  if (total === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">✂️</div>
        <h3>No orders yet</h3>
        <p>Tap "+ New Order" to add your first order</p>
      </div>
    `;
  }
  return `
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No orders match</h3>
      <p>Try a different search or filter</p>
    </div>
  `;
}


// ─── SCREEN 4: ORDER FORM ─────────────────────────────────────
/*
  New order or Edit order form.
  Has two tabs: Order Details | Measurements.

  Parameters:
    form             → the order data object being edited
    isEdit           → true if editing existing, false if new
    tab              → 'details' or 'measurements'
    repeatCustomer   → previous order by same phone number (or null)
*/
export function formScreen(form, isEdit, tab = 'details', repeatCustomer = null) {
  const total   = calcTotal(form);
  const balance = calcBalance(form);
  const um      = form.measurements?.upper || {};
  const lm      = form.measurements?.lower || {};

  return `
    <!-- Header -->
    <div class="header">
      <div style="font-weight:700;font-size:15px">
        ${isEdit ? 'Edit' : 'New'} Order #${form.orderNumber}
      </div>
      <button class="back-btn" data-action="cancel-form">✕ Cancel</button>
    </div>

    <!-- Tab bar: Details | Measurements -->
    <div class="tab-bar">
      <button
        class="tab-btn ${tab === 'details' ? 'active' : ''}"
        data-action="switch-form-tab"
        data-tab="details">
        Order Details
      </button>
      <button
        class="tab-btn ${tab === 'measurements' ? 'active' : ''}"
        data-action="switch-form-tab"
        data-tab="measurements">
        Measurements
      </button>
    </div>

    <!-- ── DETAILS TAB ─────────────────────────── -->
    ${tab === 'details' ? `

      <!-- Customer Section -->
      <div class="form-section">
        <div class="form-section-title">Customer</div>

        <div class="grid-2" style="margin-bottom:10px">
          <div>
            <label class="field-label">Name *</label>
            <input type="text" data-field="customerName"
              value="${form.customerName || ''}" placeholder="Customer name" />
          </div>
          <div>
            <label class="field-label">Phone</label>
            <input type="tel" data-field="customerPhone"
              value="${form.customerPhone || ''}" placeholder="Mobile number"
              data-action="check-repeat" />
          </div>
        </div>

        <!-- Repeat customer banner (shown when same phone is found) -->
        ${repeatCustomer ? `
          <div class="repeat-customer-alert">
            <span>↩ Repeat customer — last order #${repeatCustomer.orderNumber}</span>
            <button class="btn-ghost" data-action="copy-measurements">Copy measurements →</button>
          </div>
        ` : ''}
      </div>

      <!-- Dates Section -->
      <div class="form-section">
        <div class="form-section-title">Dates</div>
        <div class="grid-3">
          <div>
            <label class="field-label">Booking *</label>
            <input type="date" data-field="bookingDate" value="${form.bookingDate || ''}" />
          </div>
          <div>
            <label class="field-label">Trial</label>
            <input type="date" data-field="trialDate" value="${form.trialDate || ''}" />
          </div>
          <div>
            <label class="field-label">Delivery</label>
            <input type="date" data-field="deliveryDate" value="${form.deliveryDate || ''}" />
          </div>
        </div>
      </div>

      <!-- Garments Section -->
      <div class="form-section">
        <div class="form-section-title">
          <span>Garments</span>
          <button class="btn-ghost" data-action="add-garment">+ Add Item</button>
        </div>

        <!-- Each garment item -->
        ${(form.garments || []).map((g, i) => `
          <div class="garment-item">
            <div class="grid-2" style="margin-bottom:8px">
              <div>
                <label class="field-label">Type</label>
                <select data-garment="${i}" data-garment-field="type">
                  ${garmentOptions(g.type)}
                </select>
              </div>
              <div>
                <label class="field-label">Amount (₹)</label>
                <input type="number" data-garment="${i}" data-garment-field="price"
                  value="${g.price || ''}" placeholder="0" />
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:flex-end">
              <div style="flex:1">
                <label class="field-label">Details (optional)</label>
                <input type="text" data-garment="${i}" data-garment-field="details"
                  value="${g.details || ''}" placeholder="Slim fit, colour, pocket style..." />
              </div>
              ${(form.garments || []).length > 1 ? `
                <button
                  class="btn btn-danger btn-sm"
                  data-action="remove-garment"
                  data-index="${i}"
                  style="padding:9px 12px;font-size:16px">×</button>
              ` : ''}
            </div>
          </div>
        `).join('')}

        <!-- Payment summary -->
        <div class="payment-summary">
          <div class="payment-row">
            <span>Total</span>
            <span id="form-total">₹${total}</span>
          </div>
          <div class="advance-row">
            <label>Advance Paid ₹</label>
            <input type="number" data-field="advance"
              value="${form.advance || ''}" placeholder="0" />
            <span class="balance-display" id="form-balance">Balance: ₹${balance}</span>
          </div>
        </div>
      </div>

      <!-- Status Section -->
      <div class="form-section">
        <label class="field-label">Order Status</label>
        <select data-field="status" style="max-width:180px">
          ${statusOptions(form.status || 'Pending')}
        </select>
      </div>

    ` : ''}

    <!-- ── MEASUREMENTS TAB ────────────────────── -->
    ${tab === 'measurements' ? `

      <!-- Upper Body -->
      <div class="form-section">
        <div class="form-section-title">Upper Body — in inches</div>
        <p class="measure-hint">Shirt · Kurta · Coat · Blazer · Sherwani</p>
        <div class="grid-3-measure">
          ${[
            ['Length',   'length'],
            ['Chest',    'chest'],
            ['Waist',    'waist'],
            ['Hip',      'hip'],
            ['Shoulder', 'shoulder'],
            ['Sleeve',   'sleeve'],
            ['Collar',   'collar']
          ].map(([label, field]) => `
            <div>
              <label class="field-label">${label}</label>
              <input type="number" step="0.25"
                data-measure="upper" data-measure-field="${field}"
                value="${um[field] || ''}" placeholder="—" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Lower Body -->
      <div class="form-section">
        <div class="form-section-title">Lower Body — in inches</div>
        <p class="measure-hint">Pant · Trouser · Salwar</p>
        <div class="grid-3-measure">
          ${[
            ['Length',  'length'],
            ['Waist',   'waist'],
            ['Hip',     'hip'],
            ['Thigh',   'thigh'],
            ['Bottom',  'bottom'],
            ['Inseam',  'inseam']
          ].map(([label, field]) => `
            <div>
              <label class="field-label">${label}</label>
              <input type="number" step="0.25"
                data-measure="lower" data-measure-field="${field}"
                value="${lm[field] || ''}" placeholder="—" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Special Notes -->
      <div class="form-section">
        <label class="field-label">Special Notes / Instructions</label>
        <textarea
          rows="3"
          data-measure-notes
          placeholder="Slim fit, button style, pocket type, colour, special requests..."
        >${form.measurements?.notes || ''}</textarea>
      </div>

    ` : ''}

    <!-- Sticky Save Button -->
    <div class="sticky-save">
      <button class="btn btn-primary btn-block" data-action="save-order">
        Save Order #${form.orderNumber}
      </button>
    </div>
  `;
}


// ─── SCREEN 5: ORDER DETAIL ───────────────────────────────────
/*
  Shows all information about one order.
  Has buttons: advance status, edit, print, WhatsApp, delete.

  Parameters:
    order → the full order object
*/
export function detailScreen(order) {
  const cfg     = STATUS[order.status] || STATUS['Pending'];
  const total   = calcTotal(order);
  const balance = calcBalance(order);
  const um      = order.measurements?.upper || {};
  const lm      = order.measurements?.lower || {};
  const hasU    = Object.values(um).some(v => v);
  const hasL    = Object.values(lm).some(v => v);

  // Only show measurement fields that have values
  const measureBadge = (label, val) => val
    ? `<div class="measure-badge"><label>${label}</label><span>${val}"</span></div>`
    : '';

  return `
    <!-- Header -->
    <div class="header">
      <div>
        <div style="font-weight:700;font-size:15px">Order #${order.orderNumber}</div>
        <div style="font-size:11px;opacity:.75">${order.customerName}</div>
      </div>
      <button class="back-btn" data-action="back-to-list">← Back</button>
    </div>

    <div class="detail-page">

      <!-- Status bar with advance button -->
      <div class="status-bar">
        ${statusBadge(order.status)}
        <div class="status-actions">
          ${cfg.next ? `
            <button class="btn btn-primary btn-sm"
              data-action="advance-status"
              data-id="${order.firestoreId}">
              → ${cfg.next}
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm"
            data-action="edit-order"
            data-id="${order.firestoreId}">
            Edit
          </button>
        </div>
      </div>

      <!-- Customer & Date Info -->
      <div class="info-section">
        <div class="section-title">Customer & Dates</div>
        <div class="info-grid">
          <div class="info-item"><label>Customer</label><span>${order.customerName || '—'}</span></div>
          <div class="info-item"><label>Phone</label><span>${order.customerPhone || '—'}</span></div>
          <div class="info-item"><label>Booking</label><span>${fmtDate(order.bookingDate)}</span></div>
          <div class="info-item"><label>Trial</label><span>${fmtDate(order.trialDate)}</span></div>
          <div class="info-item"><label>Delivery</label><span>${fmtDate(order.deliveryDate)}</span></div>
        </div>
      </div>

      <!-- Garments & Payment -->
      <div class="info-section">
        <div class="section-title">Garments & Payment</div>
        <table class="payment-table">
          <thead>
            <tr><th>Item</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${(order.garments || []).map(g => `
              <tr>
                <td>${g.type}${g.details ? ' – ' + g.details : ''}</td>
                <td>₹${g.price || 0}</td>
              </tr>
            `).join('')}
            <tr>
              <td style="font-weight:600">Total</td>
              <td style="font-weight:600">₹${total}</td>
            </tr>
            <tr>
              <td style="color:#888">Advance Paid</td>
              <td style="color:#888">₹${parseFloat(order.advance) || 0}</td>
            </tr>
            <tr>
              <td class="payment-total">Balance Due</td>
              <td class="payment-total">₹${balance}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Measurements (only shown if they exist) -->
      ${(hasU || hasL) ? `
        <div class="info-section">
          <div class="section-title">Measurements (inches)</div>

          ${hasU ? `
            <div class="measure-subsection">Upper Body</div>
            <div class="measure-grid" style="margin-bottom:12px">
              ${measureBadge('Length',   um.length)}
              ${measureBadge('Chest',    um.chest)}
              ${measureBadge('Waist',    um.waist)}
              ${measureBadge('Hip',      um.hip)}
              ${measureBadge('Shoulder', um.shoulder)}
              ${measureBadge('Sleeve',   um.sleeve)}
              ${measureBadge('Collar',   um.collar)}
            </div>
          ` : ''}

          ${hasL ? `
            <div class="measure-subsection">Lower Body</div>
            <div class="measure-grid">
              ${measureBadge('Length', lm.length)}
              ${measureBadge('Waist',  lm.waist)}
              ${measureBadge('Hip',    lm.hip)}
              ${measureBadge('Thigh',  lm.thigh)}
              ${measureBadge('Bottom', lm.bottom)}
              ${measureBadge('Inseam', lm.inseam)}
            </div>
          ` : ''}

          ${order.measurements?.notes ? `
            <div class="notes-box" style="margin-top:10px">
              <span>Note: </span>${order.measurements.notes}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div class="detail-actions">
        <button class="btn btn-primary"
          data-action="print-order" data-id="${order.firestoreId}">
          🖨 Print Slip
        </button>

        ${order.customerPhone ? `
          <button class="btn btn-green"
            data-action="whatsapp"
            data-id="${order.firestoreId}">
            💬 WhatsApp
          </button>
        ` : ''}

        <button class="btn btn-danger"
          data-action="delete-order"
          data-id="${order.firestoreId}">
          Delete
        </button>
      </div>

    </div>
  `;
}


// ─── SCREEN 6: PRINT SLIP ────────────────────────────────────
/*
  The printable customer slip.
  Looks like the original physical slip Union Tailors uses.

  Parameters:
    order → the full order object
*/
export function printScreen(order) {
  const total   = calcTotal(order);
  const balance = calcBalance(order);

  return `
    <div class="print-page">

      <!-- The printable slip -->
      <div id="print-slip">

        <div class="slip-header">
          <div class="slip-title">Union Tailors</div>
          <div class="slip-address">8-Gol Market, Upper Storey, Shiv Chowk, Muzaffarnagar</div>
          <div class="slip-address">M. 9997545277</div>
        </div>

        <hr style="border-color:#bbb;margin:10px 0" />

        <div class="slip-info">
          <div><b>No:</b> ${order.orderNumber}</div>
          <div><b>Name:</b> ${order.customerName}</div>
          <div><b>Booking:</b> ${fmtDate(order.bookingDate)}</div>
          <div><b>Trial:</b> ${fmtDate(order.trialDate)}</div>
          <div><b>Delivery:</b> ${fmtDate(order.deliveryDate)}</div>
          ${order.customerPhone ? `<div><b>Ph:</b> ${order.customerPhone}</div>` : ''}
        </div>

        <hr style="border-color:#bbb;margin:8px 0" />

        <table class="slip-table">
          <thead>
            <tr><th>Particulars</th><th>Rs.</th></tr>
          </thead>
          <tbody>
            ${(order.garments || []).map(g => `
              <tr>
                <td>${g.type}${g.details ? ' – ' + g.details : ''}</td>
                <td>${g.price || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="slip-totals">
          <span>योग (Total)</span>          <span>${total}</span>
          <span>एडवांस (Advance)</span>     <span>${parseFloat(order.advance) || 0}</span>
          <span class="slip-balance">शेष (Balance)</span>
          <span class="slip-balance">      ${balance}</span>
        </div>

        ${order.measurements?.notes ? `
          <div class="slip-note">Note: ${order.measurements.notes}</div>
        ` : ''}

        <div class="slip-footer">ह0 प्रोप्राइटर</div>
      </div>

      <!-- These buttons do NOT print — hidden by @media print in CSS -->
      <div class="print-actions no-print">
        <button class="btn btn-primary" style="flex:1" onclick="window.print()">
          🖨 Print
        </button>
        <button class="btn btn-outline" style="flex:1"
          data-action="back-to-detail">
          ← Back
        </button>
      </div>

    </div>
  `;
}
