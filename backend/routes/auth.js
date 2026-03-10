const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { getDb, getSystemConfig } = require('../services/firebaseService');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { isSmtpEnabled, sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { sendOtpToTelegram } = require('../bot/bot');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const snap = await db.collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1).get();

    if (snap.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const userDoc = snap.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    if (!user.active) return res.status(403).json({ error: 'Account disabled' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Check email verification if SMTP configured
    const smtpEnabled = await isSmtpEnabled();
    if (smtpEnabled && !user.emailVerified && user.role !== 'admin') {
      return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_UNVERIFIED' });
    }

    const token = generateToken(user.id, user.role);
    const { password: _, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
      needsTelegramVerify: user.role === 'worker' && !user.telegramVerified
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register — Admin creates workers
router.post('/register', authMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const db = getDb();
    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const smtpEnabled = await isSmtpEnabled();

    const userRef = db.collection('users').doc();
    await userRef.set({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: 'worker',
      active: true,
      emailVerified: !smtpEnabled,
      telegramVerified: false,
      status: 'free',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send verification email if SMTP enabled
    if (smtpEnabled) {
      const token = crypto.randomBytes(32).toString('hex');
      await db.collection('emailVerifications').doc(token).set({
        userId: userRef.id,
        email: email.toLowerCase(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      const config = await getSystemConfig();
      await sendVerificationEmail(email, token, config.appUrl || process.env.FRONTEND_URL);
    }

    res.json({ success: true, userId: userRef.id, emailVerificationSent: smtpEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const db = getDb();
    const snap = await db.collection('emailVerifications').doc(token).get();

    if (!snap.exists) return res.status(400).json({ error: 'Invalid or expired token' });
    const data = snap.data();

    if (new Date() > data.expiresAt.toDate()) {
      return res.status(400).json({ error: 'Verification link expired' });
    }

    await db.collection('users').doc(data.userId).update({ emailVerified: true });
    await snap.ref.delete();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/telegram-otp/send — Send OTP to link Telegram account
router.post('/telegram-otp/send', authMiddleware(), async (req, res) => {
  try {
    const db = getDb();
    const otp = generateOtp();

    await db.collection('pendingOtps').add({
      userId: req.user.id,
      otp,
      type: 'telegram_verify',
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const config = await getSystemConfig();
    res.json({
      success: true,
      botUsername: config.botUsername,
      instructions: `Please send /start to @${config.botUsername} and enter the OTP code shown below, or click the verify button.`,
      otp
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

// POST /api/auth/telegram-otp/verify — verify OTP entered in web UI
router.post('/telegram-otp/verify', authMiddleware(), async (req, res) => {
  try {
    const { otp, telegramChatId } = req.body;
    const db = getDb();

    const snap = await db.collection('pendingOtps')
      .where('userId', '==', req.user.id)
      .where('otp', '==', otp)
      .where('type', '==', 'telegram_verify')
      .where('used', '==', false)
      .limit(1).get();

    if (snap.empty) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const otpDoc = snap.docs[0];
    if (new Date() > otpDoc.data().expiresAt.toDate()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    await otpDoc.ref.update({ used: true });
    const updateData = { telegramVerified: true };
    if (telegramChatId) updateData.telegramChatId = String(telegramChatId);
    await db.collection('users').doc(req.user.id).update(updateData);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const db = getDb();
    const snap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();

    if (snap.empty) return res.json({ success: true }); // Don't leak user existence

    const user = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const otp = generateOtp();

    await db.collection('pendingOtps').add({
      userId: user.id,
      otp,
      type: 'password_reset',
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const smtpEnabled = await isSmtpEnabled();
    if (smtpEnabled) {
      await sendPasswordResetEmail(email, otp);
    } else if (user.telegramChatId) {
      await sendOtpToTelegram(user.telegramChatId, otp, 'reset');
    }

    res.json({ success: true, via: smtpEnabled ? 'email' : 'telegram' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reset OTP' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const db = getDb();

    const userSnap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (userSnap.empty) return res.status(400).json({ error: 'Invalid request' });
    const userId = userSnap.docs[0].id;

    const otpSnap = await db.collection('pendingOtps')
      .where('userId', '==', userId)
      .where('otp', '==', otp)
      .where('type', '==', 'password_reset')
      .where('used', '==', false)
      .limit(1).get();

    if (otpSnap.empty) return res.status(400).json({ error: 'Invalid or expired OTP' });
    if (new Date() > otpSnap.docs[0].data().expiresAt.toDate()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.collection('users').doc(userId).update({ password: hashed });
    await otpSnap.docs[0].ref.update({ used: true });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware(), async (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json(safeUser);
});

module.exports = router;

// Aliases for frontend compatibility
router.post('/send-telegram-otp', authMiddleware(), async (req, res, next) => {
  req.url = '/telegram-otp/send';
  router.handle(req, res, next);
});

// Also get bot username from config
router.post('/send-telegram-otp', authMiddleware(), async (req, res) => {
  try {
    const db  = getDb();
    const otp = generateOtp();
    await db.collection('pendingOtps').add({
      userId: req.user.id, otp,
      type: 'telegram_verify', used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    const config = await getSystemConfig();
    // Get bot username via Telegram API
    let botUsername = '';
    try {
      const axios = require('axios');
      const r = await axios.get(`https://api.telegram.org/bot${config.botToken}/getMe`, { timeout: 5000 });
      botUsername = r.data.result?.username || '';
    } catch {}
    res.json({ success: true, otp, botUsername });
  } catch (err) { res.status(500).json({ error: 'Failed to generate OTP' }); }
});

router.post('/verify-telegram-otp', authMiddleware(), async (req, res) => {
  try {
    const { otp } = req.body;
    const db = getDb();
    const snap = await db.collection('pendingOtps')
      .where('userId', '==', req.user.id)
      .where('otp', '==', otp)
      .where('type', '==', 'telegram_verify')
      .where('used', '==', false)
      .limit(1).get();
    if (snap.empty) return res.status(400).json({ error: 'Invalid or expired OTP' });
    const doc = snap.docs[0];
    if (new Date() > doc.data().expiresAt.toDate()) return res.status(400).json({ error: 'OTP expired' });
    await doc.ref.update({ used: true });
    await db.collection('users').doc(req.user.id).update({ telegramVerified: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Verification failed' }); }
});
