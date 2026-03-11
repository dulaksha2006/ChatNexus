const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const { getDb } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');
const { getBot } = require('../bot/bot');

// POST /api/notifications/send — admin sends notification to worker(s)
router.post('/send', authMiddleware('admin'), async (req, res) => {
  try {
    const { workerIds, message, sendTelegram = true } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
    if (!Array.isArray(workerIds) || workerIds.length === 0)
      return res.status(400).json({ error: 'workerIds must be a non-empty array' });

    const db  = getDb();
    const bot = getBot();
    const results = [];

    for (const workerId of workerIds) {
      const workerSnap = await db.collection('users').doc(workerId).get();
      if (!workerSnap.exists) continue;
      const worker = { id: workerSnap.id, ...workerSnap.data() };

      // Save notification to Firestore (real-time badge in dashboard)
      const notifRef = await db.collection('notifications').add({
        workerId,
        workerName: worker.name || '',
        message: message.trim(),
        sentBy: req.user.id,
        sentByName: req.user.name || 'Admin',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send via Telegram if worker has linked account
      let telegramSent = false;
      if (sendTelegram && bot && worker.telegramChatId) {
        try {
          await bot.api.sendMessage(
            worker.telegramChatId,
            `📢 *Message from Admin*\n\n${message.trim()}`,
            { parse_mode: 'Markdown' }
          );
          telegramSent = true;
        } catch (e) {
          console.error(`Telegram notify failed for ${worker.name}:`, e.message);
        }
      }

      results.push({ workerId, workerName: worker.name, notifId: notifRef.id, telegramSent });
    }

    res.json({ success: true, sent: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications — worker fetches their notifications
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('notifications')
      .where('workerId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authMiddleware(), async (req, res) => {
  try {
    const db   = getDb();
    const snap = await db.collection('notifications')
      .where('workerId', '==', req.user.id)
      .where('read', '==', false).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true, marked: snap.size });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
