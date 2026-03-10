import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let db, storage, _app;

/**
 * Fetch Firebase web config from our own backend, then initialize.
 * Called once at app startup before anything renders.
 */
export async function initFirebase() {
  if (getApps().length > 0) return; // already initialized

  const res = await fetch('/api/setup/firebase-web-config');
  if (!res.ok) {
    // Setup not done yet — that's fine, App.jsx will redirect to /setup
    return;
  }
  const config = await res.json();
  if (!config.apiKey) return; // not configured yet

  _app    = initializeApp(config);
  db      = getFirestore(_app);
  storage = getStorage(_app);
}

export function getDb()      { return db; }
export function getStorage_() { return storage; }

// Named exports used by pages that import { db } directly
export { db, storage };
