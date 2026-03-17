
// Fix: Use compat imports to support v8 style syntax in modern environments
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: "AIzaSyCl8IvUyOaKyoVkapcHuoi5MKPjIq1YUjA",
  authDomain: "krishix-36276.firebaseapp.com",
  projectId: "krishix-36276",
  storageBucket: "krishix-36276.firebasestorage.app",
  messagingSenderId: "59580637677",
  appId: "1:59580637677:web:900bb8ac2d0070565347e4",
  databaseURL: "https://krishix-36276-default-rtdb.firebaseio.com"
};

// Initialize Firebase using compat mode
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
export const db = firebase.firestore();
export const auth = firebase.auth();
export const rtdb = firebase.database();

// Set Auth persistence to SESSION to avoid issues with LOCAL storage in some iframe environments
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(err => {
  console.warn("Auth persistence failed, falling back to default:", err);
});

// Enable Firestore Offline Persistence and Force Long Polling
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true
});

/*
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Firestore persistence failed: Multiple tabs open");
  } else if (err.code === 'unimplemented') {
    console.warn("Firestore persistence is not supported in this browser");
  }
});
*/

export const USERS_COLLECTION = "users";
export const LISTINGS_COLLECTION = "listings";
export const HISTORY_COLLECTION = "history";
export const ORDERS_COLLECTION = "orders";
export const HARDWARE_TASKS_COLLECTION = "hardware_tasks";

// --- Auth Services ---

export const signUp = async (email: string, pass: string, name: string, role: string) => {
  const cred = await auth.createUserWithEmailAndPassword(email, pass);
  if (cred.user) {
    await cred.user.updateProfile({ displayName: name });
    await db.collection(USERS_COLLECTION).doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      displayName: name,
      role,
      createdAt: new Date().toISOString()
    });
  }
  return cred.user;
};

export const logIn = async (email: string, pass: string) => {
  return auth.signInWithEmailAndPassword(email, pass);
};

export const logOut = async () => {
  return auth.signOut();
};

export const getUserProfile = async (uid: string) => {
  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  return doc.exists ? doc.data() : null;
};

// --- Firestore Services ---

export const addListing = async (listing: any) => {
  return db.collection(LISTINGS_COLLECTION).add({
    ...listing,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
};

export const deleteListing = async (id: string) => {
  return db.collection(LISTINGS_COLLECTION).doc(id).delete();
};

export const addOrder = async (order: any) => {
  return db.collection(ORDERS_COLLECTION).add({
    ...order,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'Pending'
  });
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  return db.collection(ORDERS_COLLECTION).doc(orderId).update({ status });
};

export const addHistory = async (historyItem: any) => {
  return db.collection(HISTORY_COLLECTION).add({
    ...historyItem,
    createdAt: new Date().toISOString()
  });
};

export const addHardwareTask = async (task: { type: string, coordinates?: { lat: number, lng: number }, metadata?: any }) => {
  // Add to Firestore for history
  const firestoreTask = await db.collection(HARDWARE_TASKS_COLLECTION).add({
    ...task,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Also update RTDB for the ESP32 to pick up (following user's code structure)
  await rtdb.ref('hardware_tasks/current_task').set({
    type: task.type,
    status: 'pending',
    timestamp: Date.now(),
    id: firestoreTask.id
  });

  return firestoreTask;
};
