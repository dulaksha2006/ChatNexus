const express = require('express');
const router  = express.Router();
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');
const { sendWorkerMessage, closeSessionFromDashboard } = require('../bot/bot');

// ⚠️  IMPORTANT: /stats/overview MUST come before /:id, otherwise Express
//     matches "stats" as the :id param and returns a session document.

// GET /api/sessions/stats/overview — dashboard stats (admin only)
router.get('/stats/overview', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    const [activeSnap, closedSnap, workersSnap] = await Promise.all([
      db.collection('sessions').where('status', '==', 'active').get(),
      db.collection('sessions').where('status', '==', 'closed').get(),
      db.collection('users').where('role', '==', 'worker').get()
    ]);

    const freeWorkers  = workersSnap.docs.filter(d => d.data().status === 'free').length;
    const busyWorkers  = workersSnap.docs.filter(d => d.data().status === 'busy').length;

    res.json({
      activeSessions: activeSnap.size,
      closedSessions: closedSnap.size,
      totalWorkers:   workersSnap.size,
      freeWorkers,
      busyWorkers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions — list sessions (admin sees all, worker sees theirs)
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    const { status, limit = 50 } = req.query;

    // Build query — Firestore requires a composite index when combining
    // where() with orderBy() on different fields.
    // We sort in JS to avoid mandatory index creation on fresh deployments.
    let q = db.collection('sessions').limit(Number(limit));

    if (req.user.role !== 'admin') {
      q = q.where('workerId', '==', req.user.id);
    }
    if (status) {
      q = q.where('status', '==', status);
    }

    const snap     = await q.get();
    const sessions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — get session with messages
router.get('/:id', authMiddleware(), async (req, res) => {
  try {
    const db          = getDb();
    const sessionSnap = await db.collection('sessions').doc(req.params.id).get();
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' });

    const session = { id: sessionSnap.id, ...sessionSnap.data() };

    // Workers can only access their own sessions
    if (req.user.role !== 'admin' && session.workerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messagesSnap = await db.collection('sessions').doc(req.params.id)
      .collection('messages').orderBy('timestamp').get();
    const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({ ...session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/message — worker sends a message to the customer
router.post('/:id/message', authMiddleware(), async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const db          = getDb();
    const sessionSnap = await db.collection('sessions').doc(req.params.id).get();
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' });

    const session = sessionSnap.data();

    // Check session is still active
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is no longer active' });
    }

    // Workers can only send to their own sessions; admin can send to any
    if (session.workerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your session' });
    }

    await sendWorkerMessage(req.params.id, content, type);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/close — close session
router.post('/:id/close', authMiddleware(), async (req, res) => {
  try {
    const db          = getDb();
    const sessionSnap = await db.collection('sessions').doc(req.params.id).get();
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' });

    const session = sessionSnap.data();
    if (session.workerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your session' });
    }

    await closeSessionFromDashboard(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
