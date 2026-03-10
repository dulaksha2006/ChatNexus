const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/languages
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('languages').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/languages — add language (admin)
router.post('/', authMiddleware('admin'), async (req, res) => {
  try {
    const { code, name, flag } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name required' });

    const db = getDb();
    const existing = await db.collection('languages').doc(code).get();
    if (existing.exists) return res.status(409).json({ error: 'Language already exists' });

    await db.collection('languages').doc(code).set({
      code, name, flag: flag || '🌐', active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Seed empty bot texts for this language (copy from English)
    const enSnap = await db.collection('botTexts').doc('en').get();
    if (enSnap.exists) {
      await db.collection('botTexts').doc(code).set({
        ...enSnap.data(),
        _language: code
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/languages/:code
router.patch('/:code', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('languages').doc(req.params.code).update(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/languages/:code
router.delete('/:code', authMiddleware('admin'), async (req, res) => {
  try {
    if (req.params.code === 'en') return res.status(400).json({ error: 'Cannot delete default language' });
    const db = getDb();
    await db.collection('languages').doc(req.params.code).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/languages/:code/texts
router.get('/:code/texts', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('botTexts').doc(req.params.code).get();
    res.json(snap.exists ? snap.data() : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/languages/:code/texts
router.put('/:code/texts', authMiddleware('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('botTexts').doc(req.params.code).set(req.body, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
