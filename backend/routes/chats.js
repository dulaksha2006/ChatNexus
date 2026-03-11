const express = require('express');
const router  = express.Router();
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');
const { sendWorkerMessage, closeSessionFromDashboard } = require('../bot/bot');

// GET /api/chats — get all chat messages for this worker grouped by sessionId
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    let q = db.collection('chats');

    if (req.user.role !== 'admin') {
      q = q.where('workerId', '==', req.user.id);
    }

    const snap = await q.get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Group by sessionId → list of unique sessions with last message
    const sessionsMap = {};
    for (const msg of messages) {
      const sid = msg.sessionId;
      if (!sessionsMap[sid]) {
        sessionsMap[sid] = {
          sessionId: sid,
          workerId: msg.workerId,
          customerTelegramId: msg.customerTelegramId,
          customerUsername: msg.customerUsername || '',
          customerFirstName: msg.customerFirstName || '',
          messages: [],
          lastMessage: null,
          lastTimestamp: null,
        };
      }
      sessionsMap[sid].messages.push(msg);
      const ts = msg.timestamp?.toMillis?.() || 0;
      if (!sessionsMap[sid].lastTimestamp || ts > sessionsMap[sid].lastTimestamp) {
        sessionsMap[sid].lastTimestamp = ts;
        sessionsMap[sid].lastMessage = msg;
      }
    }

    // Sort messages within each session
    for (const sid in sessionsMap) {
      sessionsMap[sid].messages.sort(
        (a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0)
      );
    }

    // Return sorted by lastTimestamp desc
    const sessions = Object.values(sessionsMap).sort(
      (a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0)
    );

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chats/:sessionId — get messages for one session
router.get('/:sessionId', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    let q = db.collection('chats').where('sessionId', '==', req.params.sessionId);

    const snap = await q.get();
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));

    if (messages.length === 0) return res.json({ messages: [] });

    // Auth check: worker can only see their own chats
    if (req.user.role !== 'admin' && messages[0].workerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chats/:sessionId/reply — worker sends reply via bot
router.post('/:sessionId/reply', authMiddleware(), async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    await sendWorkerMessage(req.params.sessionId, content.trim());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/chats/:sessionId/close — close session, generate PDF, delete chats
router.post('/:sessionId/close', authMiddleware(), async (req, res) => {
  try {
    await closeSessionFromDashboard(req.params.sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
