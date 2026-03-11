import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

let db, storage, _app;

export async function initFirebase() {
  if (getApps().length > 0) return;

  const res = await fetch('/api/setup/firebase-web-config');
  if (!res.ok) return;
  const config = await res.json();
  if (!config.apiKey) return;

  _app    = initializeApp(config);
  db      = getFirestore(_app);
  storage = getStorage(_app);
  // Initialize auth (needed for custom token sign-in)
  getAuth(_app);
}

export function getDb()       { return db; }
export function getStorage_() { return storage; }
export { db, storage };
