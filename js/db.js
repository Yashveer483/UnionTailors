/*
  =============================================
  db.js
  =============================================

  PURPOSE:
    ALL communication with Firebase Firestore database
    happens only in this file. No other file talks to Firestore directly.

  WHAT IS FIRESTORE?
    Firestore is like a giant JSON file stored on Google's servers.
    Our orders are stored in this structure:

      Firestore Database
      └── users/                   ← "users" collection
          └── {userId}/            ← one document per user (e.g. "abc123")
              ├── meta/            ← sub-collection for shop settings
              │   └── counter      ← stores the last order number used
              └── orders/          ← sub-collection for all orders
                  ├── {autoId1}    ← each order is one document
                  ├── {autoId2}
                  └── ...

    Each order document looks like:
      {
        orderNumber: 3470,
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        bookingDate: "2025-04-13",
        trialDate: "",
        deliveryDate: "2025-04-18",
        garments: [{ type: "Shirt", details: "Slim", price: "700" }],
        measurements: {
          upper: { length: "28", chest: "42", ... },
          lower: { length: "40", waist: "34", ... },
          notes: "Blue buttons"
        },
        advance: "200",
        status: "Pending",
        createdAt: Timestamp  ← auto-set by Firebase
      }

  FUNCTIONS EXPORTED (used in app.js):
    listenToOrders(userId, callback)              → real-time sync
    saveOrder(userId, orderData)                  → add new order
    editOrder(userId, firestoreId, orderData)     → update order
    removeOrder(userId, firestoreId)              → delete order
    getNextOrderNumber(userId)                    → get next sequential number
*/

// ─── IMPORT db from our firebase setup ───────────────────────
import { db } from './firebase-config.js';

// ─── IMPORT specific Firestore functions ─────────────────────
import {
  collection,        // Reference to a collection (like a folder)
  doc,               // Reference to a single document (like a file)
  addDoc,            // Add a new document (Firebase auto-generates ID)
  updateDoc,         // Update fields in an existing document
  deleteDoc,         // Delete a document permanently
  query,             // Build a query (like SQL SELECT)
  orderBy,           // Sort documents by a field
  onSnapshot,        // Listen for real-time changes
  serverTimestamp,   // Automatically sets current server time
  runTransaction,    // Atomic read + write (prevents duplicate order numbers)
  increment,         // Increments a number field safely
  getDoc,            // Read a single document once
  setDoc             // Create or overwrite a document with a specific ID
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";


// ─── FUNCTION 1: LISTEN TO ORDERS (Real-time) ────────────────
/*
  What it does:
    Listens for ALL orders in Firestore and calls your callback
    every time ANY order is added, changed, or deleted.

    This is what makes the app "real-time" — if your father adds
    an order on his phone, it instantly appears on your phone too.

  How it works:
    onSnapshot sets up a "listener" on the Firestore collection.
    Firebase sends updates to your app automatically.
    The listener stays active until you call the returned function.

  Parameters:
    userId   → the Firebase user ID (e.g. "xK2mN8pqR...")
    callback → function called with the orders array every time data changes

  Returns:
    An "unsubscribe" function — call it to stop listening.
    Important: always unsubscribe when you log out!

  Example:
    const unsubscribe = listenToOrders("userId123", (orders) => {
      console.log("Got orders:", orders);
    });
    // Later to stop: unsubscribe();
*/
export function listenToOrders(userId, callback) {
  // Build the path to the user's orders collection
  // Path: users → {userId} → orders
  const ordersRef = collection(db, 'users', userId, 'orders');

  // Sort orders by creation time, newest first
  const q = query(ordersRef, orderBy('createdAt', 'desc'));

  // Start listening — onSnapshot fires immediately, then on every change
  return onSnapshot(q, (snapshot) => {
    // Convert Firestore documents to plain JavaScript objects
    const orders = snapshot.docs.map(document => ({
      firestoreId: document.id,   // Firestore's internal ID (for update/delete)
      ...document.data()          // All our order fields (orderNumber, name, etc.)
    }));

    // Call the callback with the fresh orders list
    callback(orders);

  }, (error) => {
    // If there's an error (e.g. permission denied), log it
    console.error('Error listening to orders:', error);
    callback([]);
  });
}


// ─── FUNCTION 2: GET NEXT ORDER NUMBER ───────────────────────
/*
  What it does:
    Gets the next sequential order number (e.g. 3470, 3471, 3472...)

  Why it's complicated:
    If two people create orders at the same time, we can't just
    do "lastNumber + 1" because both would get the same number.
    We use a Firebase "transaction" which locks the counter,
    reads it, increments it, and writes it — all atomically.
    "Atomic" means it's all-or-nothing. No duplicates possible.

  Parameters:
    userId → the Firebase user ID

  Returns:
    A number like 3471
*/
export async function getNextOrderNumber(userId) {
  // Reference to our counter document
  // Path: users → {userId} → meta → counter
  const counterRef = doc(db, 'users', userId, 'meta', 'counter');

  let orderNumber;

  // runTransaction locks this document while we read + write it
  await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    if (!counterDoc.exists()) {
      // First ever order — start at 3470 (continuing from physical book)
      orderNumber = 3470;
      transaction.set(counterRef, { lastOrderNumber: 3470 });
    } else {
      // Get current number and increment
      orderNumber = counterDoc.data().lastOrderNumber + 1;
      transaction.update(counterRef, { lastOrderNumber: increment(1) });
    }
  });

  return orderNumber;
}


// ─── FUNCTION 3: SAVE NEW ORDER ──────────────────────────────
/*
  What it does:
    Adds a brand new order to Firestore.
    Firebase automatically generates a unique document ID.
    We also add a serverTimestamp for sorting.

  Parameters:
    userId    → the Firebase user ID
    orderData → the order object (customerName, garments, etc.)

  Returns:
    { success: true }  or  { success: false, error: "..." }
*/
export async function saveOrder(userId, orderData) {
  try {
    // Path to orders collection: users → {userId} → orders
    const ordersRef = collection(db, 'users', userId, 'orders');

    // Add the order with an automatic Firestore-generated ID
    await addDoc(ordersRef, {
      ...orderData,
      createdAt: serverTimestamp()  // Firebase sets this to exact server time
    });

    return { success: true };

  } catch (error) {
    console.error('Error saving order:', error);
    return { success: false, error: 'Could not save order. Check your internet connection.' };
  }
}


// ─── FUNCTION 4: EDIT EXISTING ORDER ─────────────────────────
/*
  What it does:
    Updates an existing order's fields in Firestore.
    Only updates the fields you provide — other fields stay the same.

  Parameters:
    userId      → the Firebase user ID
    firestoreId → the Firestore document ID (e.g. "xKm2Npq3R...")
                  This is different from orderNumber (3470)!
    orderData   → the updated order fields

  Returns:
    { success: true }  or  { success: false, error: "..." }
*/
export async function editOrder(userId, firestoreId, orderData) {
  try {
    // Build exact path to this specific order document
    const orderRef = doc(db, 'users', userId, 'orders', firestoreId);

    // updateDoc only updates the fields we provide
    await updateDoc(orderRef, orderData);

    return { success: true };

  } catch (error) {
    console.error('Error updating order:', error);
    return { success: false, error: 'Could not update order. Check your internet connection.' };
  }
}


// ─── FUNCTION 5: DELETE ORDER ────────────────────────────────
/*
  What it does:
    Permanently deletes an order from Firestore.
    ⚠️  This cannot be undone!

  Parameters:
    userId      → the Firebase user ID
    firestoreId → the Firestore document ID

  Returns:
    { success: true }  or  { success: false, error: "..." }
*/
export async function removeOrder(userId, firestoreId) {
  try {
    const orderRef = doc(db, 'users', userId, 'orders', firestoreId);
    await deleteDoc(orderRef);
    return { success: true };

  } catch (error) {
    console.error('Error deleting order:', error);
    return { success: false, error: 'Could not delete order.' };
  }
}
