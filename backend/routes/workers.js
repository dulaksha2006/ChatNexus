const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const bcrypt  = require('bcryptjs');
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

// ⚠️  IMPORTANT: /me/* routes MUST come before /:id to prevent Express
//     from matching the literal string "me" as a :id param.

// GET /api/workers
router.get('/', authMiddleware('admin'), async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('users').where('role', '==', 'worker').get();
    const workers = snap.docs
      .map(d => { const { password, ...safe } = d.data(); return { id: d.id, ...safe }; })
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    res.json(workers);
  } catch (err) {
    console.error('Workers GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workers/me/greeting — worker edits their own greeting
// ✅ Must be before /:id
router.patch('/me/greeting', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    const { greeting } = req.body;
    if (greeting === undefined) return res.status(400).json({ error: 'Greeting is required' });
    await db.collection('users').doc(req.user.id).update({
      greeting,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/workers/me/status — worker updates their own online/busy/offline status
// ✅ Must be before /:id
router.patch('/me/status', authMiddleware(), async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['free', 'busy', 'offline'];
    if (!valid.includes(status))
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
    const db = getDb();
    await db.collection('users').doc(req.user.id).update({ status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/workers/:id — admin edits any worker
router.patch('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { name, active, greeting } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name     !== undefined) updates.name     = name;
    if (active   !== undefined) updates.active   = active;
    if (greeting !== undefined) updates.greeting = greeting;
    await db.collection('users').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/workers/:id — soft-delete (deactivate)
router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('users').doc(req.params.id).update({
      active: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
