const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');
const { syncBotCommands } = require('../bot/bot');

// GET /api/commands
router.get('/', authMiddleware('admin'), async (req, res) => {
  const db   = getDb();
  const snap = await db.collection('botCommands').orderBy('order').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

// POST /api/commands
router.post('/', authMiddleware('admin'), async (req, res) => {
  const db  = getDb();
  const ref = db.collection('botCommands').doc();
  const { command, label, action, responseText, menuId, order } = req.body;
  await ref.set({
    command: command.replace(/^\//, '').toLowerCase(),
    label, action, responseText: responseText || '',
    menuId: menuId || null, order: order || 99,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await syncBotCommands().catch(() => {});
  res.json({ id: ref.id });
});

// PATCH /api/commands/:id
router.patch('/:id', authMiddleware('admin'), async (req, res) => {
  const db = getDb();
  const updates = { ...req.body };
  if (updates.command) updates.command = updates.command.replace(/^\//, '').toLowerCase();
  await db.collection('botCommands').doc(req.params.id).update(updates);
  await syncBotCommands().catch(() => {});
  res.json({ success: true });
});

// DELETE /api/commands/:id
router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  const db = getDb();
  await db.collection('botCommands').doc(req.params.id).delete();
  await syncBotCommands().catch(() => {});
  res.json({ success: true });
});

// ── Menus ─────────────────────────────────────────────────────────────────────
// GET /api/commands/menus
router.get('/menus', authMiddleware('admin'), async (req, res) => {
  const db   = getDb();
  const snap = await db.collection('botMenus').orderBy('createdAt').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

// POST /api/commands/menus
router.post('/menus', authMiddleware('admin'), async (req, res) => {
  const db  = getDb();
  const ref = db.collection('botMenus').doc();
  await ref.set({
    title: req.body.title || 'Menu',
    items: req.body.items || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  res.json({ id: ref.id });
});

// PATCH /api/commands/menus/:id
router.patch('/menus/:id', authMiddleware('admin'), async (req, res) => {
  const db = getDb();
  await db.collection('botMenus').doc(req.params.id).update(req.body);
  res.json({ success: true });
});

// DELETE /api/commands/menus/:id
router.delete('/menus/:id', authMiddleware('admin'), async (req, res) => {
  const db = getDb();
  await db.collection('botMenus').doc(req.params.id).delete();
  res.json({ success: true });
});

module.exports = router;
