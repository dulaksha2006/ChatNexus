const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const { getDb, getSystemConfig, setSystemConfig } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/settings
router.get('/', authMiddleware('admin'), async (req, res) => {
  try {
    const config = await getSystemConfig();
    // Strip sensitive fields before sending to client
    const { botToken, ...safe } = config || {};
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/smtp
router.patch('/smtp', authMiddleware('admin'), async (req, res) => {
  try {
    await setSystemConfig({ smtp: req.body });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/general
router.patch('/general', authMiddleware('admin'), async (req, res) => {
  try {
    const { channelId, appName } = req.body;
    const updates = {};
    if (channelId) updates.channelId = channelId;
    if (appName)   updates.appName   = appName;
    await setSystemConfig(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quick Replies ─────────────────────────────────────────────────────────────

// GET /api/settings/quick-replies — accessible to all authenticated users (workers need this)
router.get('/quick-replies', authMiddleware(), async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('quickReplies')
      .orderBy('createdAt', 'asc').get();
    const replies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(replies);
  } catch (err) {
    // If collection doesn't exist yet, return empty array
    res.json([]);
  }
});

// POST /api/settings/quick-replies — admin creates a quick reply
router.post('/quick-replies', authMiddleware('admin'), async (req, res) => {
  try {
    const { label, text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const db  = getDb();
    const ref = await db.collection('quickReplies').add({
      label: label || text.slice(0, 30),
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/quick-replies/:id — admin removes a quick reply
router.delete('/quick-replies/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('quickReplies').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Blacklist ─────────────────────────────────────────────────────────────────

// GET /api/settings/blacklist
router.get('/blacklist', authMiddleware('admin'), async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('blacklist').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.json([]);
  }
});

// POST /api/settings/blacklist
router.post('/blacklist', authMiddleware('admin'), async (req, res) => {
  try {
    const { telegramId, reason } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId is required' });
    const db = getDb();
    await db.collection('blacklist').doc(String(telegramId)).set({
      telegramId: String(telegramId),
      reason: reason || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/blacklist/:id
router.delete('/blacklist/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('blacklist').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
