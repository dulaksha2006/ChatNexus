const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const bcrypt  = require('bcryptjs');
const admin   = require('firebase-admin');
const {
  initWithCredentials, isInitialized,
  setSystemConfig, getSystemConfig
} = require('../services/firebaseService');
const { startBot } = require('../bot/bot');

// GET /api/setup/status
router.get('/status', async (req, res) => {
  try {
    if (!isInitialized()) return res.json({ setupComplete: false });
    const config = await getSystemConfig();
    res.json({ setupComplete: !!(config?.setupComplete) });
  } catch { res.json({ setupComplete: false }); }
});

// GET /api/setup/firebase-web-config
router.get('/firebase-web-config', async (req, res) => {
  try {
    if (!isInitialized()) return res.json({});
    const config = await getSystemConfig();
    res.json(config?.firebaseWebConfig || {});
  } catch { res.json({}); }
});

// POST /api/setup/validate-firebase
router.post('/validate-firebase', async (req, res) => {
  const { serviceAccountJson, storageBucket } = req.body;
  if (!serviceAccountJson) return res.status(400).json({ error: 'Service account JSON required' });

  let parsed;
  try {
    parsed = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const missing = ['type','project_id','private_key','client_email'].filter(k => !parsed[k]);
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  if (parsed.type !== 'service_account') return res.status(400).json({ error: 'Must be a service_account key' });

  try {
    await initWithCredentials(parsed, storageBucket || `${parsed.project_id}.appspot.com`);
    res.json({ valid: true, projectId: parsed.project_id });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('PERMISSION_DENIED') || msg.includes('firestore.googleapis.com')) {
      return res.status(400).json({
        error: `Firestore API not enabled for project "${parsed.project_id}". Enable it then try again.`,
        firestoreUrl: `https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${parsed.project_id}`
      });
    }
    res.status(400).json({ error: 'Firebase connection failed: ' + msg });
  }
});

// POST /api/setup/validate-bot
router.post('/validate-bot', async (req, res) => {
  const { botToken, channelId } = req.body;
  if (!botToken || !channelId) return res.status(400).json({ error: 'botToken and channelId required' });
  try {
    const me = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 8000 });
    if (!me.data.ok) return res.status(400).json({ error: 'Invalid bot token' });
    const msg = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: channelId, text: '✅ Bot connected!', parse_mode: 'Markdown' }, { timeout: 8000 });
    if (!msg.data.ok) return res.status(400).json({ error: 'Cannot message channel — check ID and bot admin status' });
    res.json({ valid: true, botUsername: me.data.result.username, botName: me.data.result.first_name });
  } catch (err) { res.status(400).json({ error: err.response?.data?.description || err.message }); }
});

// POST /api/setup/complete
router.post('/complete', async (req, res) => {
  try {
    if (!isInitialized()) return res.status(400).json({ error: 'Firebase not initialized' });
    const existing = await getSystemConfig();
    if (existing?.setupComplete) return res.status(409).json({ error: 'Already configured' });

    const { botToken, channelId, adminEmail, adminPassword, adminName, smtp, firebaseWebConfig, company } = req.body;
    if (!botToken || !channelId || !adminEmail || !adminPassword || !adminName)
      return res.status(400).json({ error: 'Missing required fields' });

    const db      = require('../services/firebaseService').getDb();
    const hashed  = await bcrypt.hash(adminPassword, 12);
    const adminRef = db.collection('users').doc();
    await adminRef.set({
      name: adminName, email: adminEmail.toLowerCase(), password: hashed,
      role: 'admin', active: true, emailVerified: !smtp?.host, telegramVerified: true,
      status: 'free', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const systemConfig = { setupComplete: true, botToken, channelId, adminId: adminRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp() };
    if (smtp?.host)                systemConfig.smtp = smtp;
    if (firebaseWebConfig?.apiKey) systemConfig.firebaseWebConfig = firebaseWebConfig;
    if (company?.name)             systemConfig.company = company;
    await setSystemConfig(systemConfig);

    // Seed English language + bot texts only
    await db.collection('languages').doc('en').set({
      code: 'en', name: 'English', flag: '🇺🇸', active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('botTexts').doc('en').set({
      welcome: '👋 Welcome to Support!', selectLanguage: '🌐 Select your language:',
      noWorkers: '😔 All agents are busy. Please try again shortly.',
      sessionStarted: '✅ Connected to a support agent.',
      sessionEndedCustomer: '✅ Session ended. Thank you!',
      sessionEndedManual: '✅ Session closed by the agent.',
      sessionEndedTimeout: '⏱ Session ended due to inactivity.',
      alreadyInSession: '💬 You already have an active session.',
      otpMessage: '🔐 Your OTP: {otp}', resetOtp: '🔑 Reset OTP: {otp}'
    });
    // NOTE: No default bot commands seeded — admin adds them via Commands page

    await startBot(botToken);
    res.json({ success: true });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
});

module.exports = router;
