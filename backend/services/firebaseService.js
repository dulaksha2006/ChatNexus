const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db, storage, auth;

/**
 * Initialize Firebase Admin.
 * On first boot (no credentials yet), init with a placeholder so the
 * /api/setup routes can write the credentials to disk, then re-init.
 */
async function initializeFirebase() {
  if (admin.apps.length > 0) return;

  const credPath = path.join(__dirname, '../../firebase-credentials.json');

  if (fs.existsSync(credPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: serviceAccount.storageBucket || process.env.FIREBASE_STORAGE_BUCKET
    });
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    storage = admin.storage();
    auth    = admin.auth();
  }
  // If no credentials yet, do nothing — setup wizard will call initWithCredentials()
}

/**
 * Called by the setup wizard after collecting credentials from the user.
 * Saves them to disk and (re)initializes Firebase Admin.
 */
async function initWithCredentials(serviceAccountJson, storageBucket) {
  const credPath = path.join(__dirname, '../../firebase-credentials.json');

  // Attach storageBucket into the cred file for convenience
  const cred = { ...serviceAccountJson, storageBucket };
  fs.writeFileSync(credPath, JSON.stringify(cred, null, 2));

  // Destroy existing app if any
  if (admin.apps.length > 0) {
    await admin.app().delete();
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountJson),
    storageBucket
  });

  db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
  storage = admin.storage();
  auth    = admin.auth();
}

function isInitialized() {
  return admin.apps.length > 0 && !!db;
}

function getDb()      { return db; }
function getStorage() { return storage; }
function getAuth()    { return auth; }

// ─── Generic Helpers ──────────────────────────────────────────────────────────

async function getSystemConfig() {
  const snap = await db.collection('configs').doc('system').get();
  return snap.exists ? snap.data() : null;
}

async function setSystemConfig(data) {
  await db.collection('configs').doc('system').set(data, { merge: true });
}

async function getLanguages() {
  const snap = await db.collection('languages').orderBy('createdAt').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getBotTexts(langCode) {
  const snap = await db.collection('botTexts').doc(langCode).get();
  return snap.exists ? snap.data() : null;
}

async function getWorkerByTelegramId(telegramId) {
  const snap = await db.collection('users')
    .where('telegramChatId', '==', String(telegramId))
    .where('role', '==', 'worker')
    .limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getFreeWorker() {
  const snap = await db.collection('users')
    .where('role', '==', 'worker')
    .where('status', '==', 'free')
    .where('active', '==', true)
    .where('telegramVerified', '==', true)
    .limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getActiveSessionByCustomer(customerTelegramId) {
  const snap = await db.collection('sessions')
    .where('customerTelegramId', '==', String(customerTelegramId))
    .where('status', '==', 'active')
    .limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function createSession(data) {
  const ref = await db.collection('sessions').add({
    ...data,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function addMessage(sessionId, message) {
  await db.collection('sessions').doc(sessionId)
    .collection('messages').add({
      ...message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  await db.collection('sessions').doc(sessionId).update({
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function getSessionMessages(sessionId) {
  const snap = await db.collection('sessions').doc(sessionId)
    .collection('messages').orderBy('timestamp').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function closeSession(sessionId) {
  await db.collection('sessions').doc(sessionId).update({
    status: 'closed',
    closedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function setWorkerStatus(workerId, status) {
  await db.collection('users').doc(workerId).update({ status });
}

module.exports = {
  initializeFirebase,
  initWithCredentials,
  isInitialized,
  getDb,
  getStorage,
  getAuth,
  getSystemConfig,
  setSystemConfig,
  getLanguages,
  getBotTexts,
  getWorkerByTelegramId,
  getFreeWorker,
  getActiveSessionByCustomer,
  createSession,
  addMessage,
  getSessionMessages,
  closeSession,
  setWorkerStatus
};
