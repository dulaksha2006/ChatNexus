require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');
const rateLimit = require('express-rate-limit');
const { initializeFirebase, isInitialized } = require('./services/firebaseService');
const { startBot } = require('./bot/bot');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Trust Railway / any reverse proxy ────────────────────────────────────────
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ── Setup & health — always available ────────────────────────────────────────
app.use('/api/setup',  require('./routes/setup'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', initialized: isInitialized() }));

// ── Gate other /api routes until Firebase is ready ───────────────────────────
app.use('/api', (req, res, next) => {
  if (!isInitialized()) {
    return res.status(503).json({ error: 'System not configured yet.', code: 'SETUP_REQUIRED' });
  }
  next();
});

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/chats',     require('./routes/chats'));
app.use('/api/workers',   require('./routes/workers'));
app.use('/api/languages', require('./routes/languages'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/commands',  require('./routes/commands'));

// ── Serve React frontend only if dist exists (production build) ───────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Dev mode — frontend is served by Vite on its own port
  app.get('*', (req, res) => {
    res.json({ message: 'Backend running. Start Vite dev server for the frontend (cd frontend && npm run dev).' });
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await initializeFirebase();
    if (isInitialized()) {
      console.log('✅ Firebase initialized');
      const { getSystemConfig } = require('./services/firebaseService');
      const config = await getSystemConfig();
      if (config?.setupComplete && config?.botToken) {
        await startBot(config.botToken);
        console.log('✅ Telegram bot started');
      } else {
        console.log('⚠️  Setup not complete — open the web UI');
      }
    } else {
      console.log('⚠️  No Firebase credentials yet — open the web UI to run the setup wizard');
    }
  } catch (err) {
    console.error('⚠️  Boot warning:', err.message);
  }

  app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
}

boot();
module.exports = app;
