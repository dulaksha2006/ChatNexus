import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

let db, storage;

export async function initFirebase() {
  if (getApps().length > 0) return;

  const res = await fetch('/api/setup/firebase-web-config');
  if (!res.ok) return;
  const config = await res.json();
  if (!config.apiKey) return;

  const app = initializeApp(config);
  db      = getFirestore(app);
  storage = getStorage(app);
  // Auth must be initialized on same app instance
  getAuth(app);
}

// Returns the Auth instance — safe to call after initFirebase()
export function getFirebaseAuth() {
  try { return getAuth(getApp()); } catch { return null; }
}

export function getDb()       { return db; }
export function getStorage_() { return storage; }
export { db, storage };
