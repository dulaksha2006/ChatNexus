const { Bot, InlineKeyboard, InputFile } = require('grammy');
const admin  = require('firebase-admin');
const fs     = require('fs');
const {
  getDb, getBotTexts, getFreeWorker, getLanguages,
  getActiveSessionByCustomer, createSession, addMessage,
  closeSession, setWorkerStatus, getSystemConfig
} = require('../services/firebaseService');
const { generateSessionPDF } = require('../services/pdfService');

let bot;
const inactivityTimers = new Map();

// ─── Inactivity timer: resets only on AGENT reply ─────────────────────────────
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function startAgentOnlyTimer(sessionId, custId, workerTgId) {
  clearTimer(sessionId);
  inactivityTimers.set(sessionId,
    setTimeout(() => endSession(sessionId, custId, workerTgId, 'timeout'), TIMEOUT_MS)
  );
}

function clearTimer(sessionId) {
  if (inactivityTimers.has(sessionId)) {
    clearTimeout(inactivityTimers.get(sessionId));
    inactivityTimers.delete(sessionId);
  }
}

// ─── Default texts ────────────────────────────────────────────────────────────
async function texts(lang = 'en') {
  return (await getBotTexts(lang)) || {
    welcome:              '👋 Welcome! How can we help you?',
    selectLanguage:       '🌐 Please select your language:',
    noWorkers:            '😔 All agents are busy. Please try again shortly.',
    sessionStarted:       '✅ You are connected to a support agent.',
    sessionEndedCustomer: '✅ Session ended. Thank you!',
    sessionEndedManual:   '✅ Session closed by agent.',
    sessionEndedTimeout:  '⏱ Session ended due to agent inactivity.',
    alreadyInSession:     '💬 You already have an active session.',
    blacklisted:          '🚫 You are not allowed to use this service.',
  };
}

// ─── Blacklist check ──────────────────────────────────────────────────────────
async function isBlacklisted(chatId) {
  try {
    const db   = getDb();
    const snap = await db.collection('blacklist').doc(String(chatId)).get();
    return snap.exists;
  } catch { return false; }
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function getCommands() {
  try {
    const db   = getDb();
    const snap = await db.collection('botCommands').where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 99) - (b.order || 99));
  } catch { return []; }
}

async function getMenu(menuId) {
  if (!menuId) return null;
  const snap = await getDb().collection('botMenus').doc(menuId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getUserLang(chatId) {
  try {
    const snap = await getDb().collection('userPrefs').doc(String(chatId)).get();
    return snap.exists ? snap.data().lang : null;
  } catch { return null; }
}

async function setUserLang(chatId, lang) {
  try {
    await getDb().collection('userPrefs').doc(String(chatId)).set({ lang }, { merge: true });
  } catch {}
}

// ─── OTP verification ─────────────────────────────────────────────────────────
async function tryVerifyOtp(chatId, otp) {
  const db   = getDb();
  const snap = await db.collection('pendingOtps')
    .where('otp', '==', otp).where('used', '==', false).get();
  if (snap.empty) return false;

  const doc  = snap.docs[0];
  const data = doc.data();
  if (new Date() > data.expiresAt.toDate()) return false;

  await doc.ref.update({ used: true });

  if (data.type === 'telegram_verify') {
    await db.collection('users').doc(data.userId).update({
      telegramChatId: String(chatId), telegramVerified: true
    });
    await bot.api.sendMessage(chatId, '✅ Telegram linked! You can now log in to the dashboard.');
  } else if (data.type === 'password_reset') {
    await bot.api.sendMessage(chatId,
      `🔑 Your password reset OTP: *${otp}*\n\nEnter this in the dashboard.`,
      { parse_mode: 'Markdown' });
  }
  return true;
}

// ─── Welcome / Language screens ───────────────────────────────────────────────
async function showWelcome(ctx, lang) {
  const t    = await texts(lang);
  const cmds = await getCommands();
  if (!cmds.length) return ctx.reply(t.welcome);
  const kb = new InlineKeyboard();
  cmds.forEach((cmd, i) => {
    kb.text(cmd.label || cmd.command, `cmd:${cmd.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply(t.welcome, { reply_markup: kb });
}

async function showLangSelect(ctx) {
  const langs = (await getLanguages()).filter(l => l.active);
  if (langs.length <= 1) {
    const lang = langs[0]?.code || 'en';
    await setUserLang(ctx.chat.id, lang);
    return showWelcome(ctx, lang);
  }
  const t  = await texts();
  const kb = new InlineKeyboard();
  langs.forEach((l, i) => {
    kb.text(`${l.flag || '🌐'} ${l.name}`, `lang:${l.code}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply(t.selectLanguage, { reply_markup: kb });
}

async function showMenu(ctx, menuId) {
  const menu = await getMenu(menuId);
  if (!menu?.items?.length) return ctx.reply('Menu not available.');
  const kb = new InlineKeyboard();
  menu.items.forEach((item, i) => {
    const cb = item.action === 'submenu' ? `submenu:${item.submenuId}` : `maction:${item.action}:${i}`;
    kb.text(item.label, cb);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply(menu.title || 'Menu:', { reply_markup: kb });
}

// ─── Contact agent ────────────────────────────────────────────────────────────
async function contactAgent(ctx, lang) {
  const chatId = String(ctx.chat.id);
  const t      = await texts(lang);

  // ✅ Check blacklist before proceeding
  if (await isBlacklisted(chatId)) return ctx.reply(t.blacklisted);

  const existing = await getActiveSessionByCustomer(chatId);
  if (existing) return ctx.reply(t.alreadyInSession);

  const worker = await getFreeWorker();
  if (!worker)  return ctx.reply(t.noWorkers);

  const sessionData = {
    customerTelegramId: chatId,
    customerUsername:   ctx.from.username   || '',
    customerFirstName:  ctx.from.first_name || '',
    workerId:           worker.id,
    workerTelegramId:   worker.telegramChatId || null,
    workerName:         worker.name || '',
    language:           lang,
  };
  // Remove undefined — Firestore rejects them
  Object.keys(sessionData).forEach(k => sessionData[k] === undefined && delete sessionData[k]);

  const sessionId = await createSession(sessionData);
  await setWorkerStatus(worker.id, 'busy');
  await ctx.reply(t.sessionStarted);

  // Auto-greeting from agent
  const greeting = worker.greeting || `Hi! My name is ${worker.name}. How can I assist you today?`;
  setTimeout(async () => {
    try {
      await bot.api.sendMessage(chatId, greeting);
      await addMessage(sessionId, {
        from: 'worker', sessionId,
        senderName: worker.name || 'Agent',
        type: 'text', content: greeting
      });
      startAgentOnlyTimer(sessionId, chatId, worker.telegramChatId || null);
    } catch (e) { console.error('greeting error:', e.message); }
  }, 800);
}

// ─── Session end ──────────────────────────────────────────────────────────────
async function endSession(sessionId, custChatId, workerTgId, reason) {
  clearTimer(sessionId);
  const db = getDb();
  try {
    const snap = await db.collection('sessions').doc(sessionId).get();
    if (!snap.exists || snap.data().status !== 'active') return;
    const session = { id: sessionId, ...snap.data() };

    await closeSession(sessionId);

    // ✅ FIX: Always reset worker status to 'free' (not 'busy') after session ends
    if (session.workerId) await setWorkerStatus(session.workerId, 'free');

    const t = await texts(session.language);

    // Notify worker on Telegram if they have a linked account
    if (workerTgId) {
      const msg = reason === 'timeout' ? t.sessionEndedTimeout : t.sessionEndedManual;
      await bot.api.sendMessage(workerTgId, msg).catch(() => {});
    }

    await bot.api.sendMessage(custChatId, t.sessionEndedCustomer).catch(() => {});
    await dispatchReport(session, custChatId);
  } catch (err) { console.error('endSession error:', err.message); }
}

// ─── PDF report dispatch ──────────────────────────────────────────────────────
async function dispatchReport(session, custChatId) {
  try {
    const config = await getSystemConfig();
    if (!config?.channelId) return;

    const db      = getDb();
    const msgSnap = await db.collection('sessions').doc(session.id)
      .collection('messages').get();
    const msgs = msgSnap.docs
      .map(d => d.data())
      .sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));

    // Forward videos (<10MB) to channel
    for (const m of msgs) {
      if (m.type === 'video' && m.telegramMessageId) {
        await bot.api.forwardMessage(config.channelId, custChatId, m.telegramMessageId).catch(() => {});
      }
    }

    const pdfPath    = await generateSessionPDF(session, msgs);
    const workerSnap = session.workerId
      ? await db.collection('users').doc(session.workerId).get() : null;
    const caption    = `📋 *Session Report*\n👤 User: ${session.customerTelegramId}\n👷 Agent: ${workerSnap?.data()?.name || '—'}\n💬 Messages: ${msgs.length}`;

    await bot.api.sendDocument(config.channelId, new InputFile(pdfPath), {
      caption, parse_mode: 'Markdown'
    });
    fs.unlink(pdfPath, () => {});
  } catch (err) { console.error('dispatchReport error:', err.message); }
}

// ─── Relay customer → Firestore + notify worker on Telegram ─────────────────
async function relayToWorker(ctx, session) {
  const msg = ctx.message;

  let data = {
    from: 'customer', sessionId: session.id,
    senderName: ctx.from.first_name || 'Customer',
    telegramMessageId: msg.message_id
  };

  if (msg.text)          { data.type = 'text';     data.content = msg.text; }
  else if (msg.photo)    {
    const p = msg.photo[msg.photo.length - 1];
    data.type = 'image';
    data.fileId = p.file_id;
    data.fileUrl = await tgFileUrl(p.file_id);
    data.content = msg.caption || '';
  }
  else if (msg.voice)    { data.type = 'voice';    data.fileId = msg.voice.file_id;    data.duration = msg.voice.duration; data.content = ''; }
  else if (msg.video)    { data.type = 'video';    data.fileId = msg.video.file_id;    data.content = msg.caption || '';  }
  else if (msg.document) { data.type = 'document'; data.fileId = msg.document.file_id; data.fileName = msg.document.file_name; data.content = msg.caption || ''; }
  else return;

  // Clean undefined values
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  await addMessage(session.id, data);

  // ✅ FIX: Also forward text to worker's Telegram so they get a notification
  //    even when the web dashboard is closed. Worker can reply only via dashboard.
  if (session.workerTelegramId && data.type === 'text') {
    const customerName = ctx.from.first_name || `User ${String(ctx.chat.id).slice(-4)}`;
    await bot.api.sendMessage(
      session.workerTelegramId,
      `💬 *${customerName}*: ${data.content}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

async function tgFileUrl(fileId) {
  try {
    const f = await bot.api.getFile(fileId);
    return `https://api.telegram.org/file/bot${bot.token}/${f.file_path}`;
  } catch { return null; }
}

// ─── Bot init ─────────────────────────────────────────────────────────────────
async function startBot(token) {
  bot = new Bot(token);

  bot.catch(err => {
    console.error('Bot error:', err.error?.message || err.message);
  });

  bot.on('message', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text   = ctx.message?.text || '';
    const db     = getDb();

    // 1. Blacklist guard
    if (await isBlacklisted(chatId)) return;

    // 2. 6-digit OTP
    if (/^\d{6}$/.test(text.trim())) {
      if (await tryVerifyOtp(chatId, text.trim())) return;
    }

    // 3. Slash command
    if (text.startsWith('/')) {
      const cmdName  = text.split(/\s+/)[0].slice(1).toLowerCase().split('@')[0];
      const arg      = text.split(/\s+/).slice(1).join(' ').trim();
      const commands = await getCommands();
      const matched  = commands.find(c => c.command?.replace(/^\//, '') === cmdName);

      if (matched) {
        const lang = (await getUserLang(chatId)) || 'en';
        if (matched.action === 'verify_otp') {
          if (!arg) return ctx.reply('Send your 6-digit OTP code directly here.');
          if (!(await tryVerifyOtp(chatId, arg))) return ctx.reply('❌ Invalid or expired OTP.');
          return;
        }
        if (matched.action === 'welcome')       { if (!(await getUserLang(chatId))) return showLangSelect(ctx); return showWelcome(ctx, lang); }
        if (matched.action === 'contact_agent') return contactAgent(ctx, lang);
        if (matched.action === 'send_menu')     return showMenu(ctx, matched.menuId);
        if (matched.action === 'custom_text') {
          const bt = await getBotTexts(lang);
          return ctx.reply(bt?.cmdTexts?.[matched.id] || matched.responseText || '');
        }
      }
      return; // unknown command — ignore
    }

    // 4. Active session → relay to Firestore
    const session = await getActiveSessionByCustomer(chatId);
    if (session) return relayToWorker(ctx, session);

    // 5. Fallback — show welcome
    const lang = (await getUserLang(chatId)) || 'en';
    if (!await getUserLang(chatId)) return showLangSelect(ctx);
    await showWelcome(ctx, lang);
  });

  bot.callbackQuery(/^lang:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    const lang = ctx.match[1];
    await setUserLang(ctx.chat.id, lang);
    await showWelcome(ctx, lang);
  });

  bot.callbackQuery(/^cmd:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    const snap = await getDb().collection('botCommands').doc(ctx.match[1]).get();
    if (!snap.exists) return;
    const cmd  = snap.data();
    const lang = (await getUserLang(ctx.chat.id)) || 'en';
    if (cmd.action === 'welcome')       return showWelcome(ctx, lang);
    if (cmd.action === 'contact_agent') return contactAgent(ctx, lang);
    if (cmd.action === 'send_menu')     return showMenu(ctx, cmd.menuId);
    if (cmd.action === 'custom_text') {
      const bt = await getBotTexts(lang);
      return ctx.reply(bt?.cmdTexts?.[snap.id] || cmd.responseText || '');
    }
  });

  bot.callbackQuery(/^maction:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    const action = ctx.match[1];
    const lang   = (await getUserLang(ctx.chat.id)) || 'en';
    if (action === 'contact_agent') return contactAgent(ctx, lang);
    if (action === 'welcome')       return showWelcome(ctx, lang);
  });

  bot.callbackQuery(/^submenu:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    await showMenu(ctx, ctx.match[1]);
  });

  bot.start({ drop_pending_updates: true });
  console.log('✅ Telegram bot polling started');
  return bot;
}

// ─── Public API ───────────────────────────────────────────────────────────────
async function syncBotCommands() {
  if (!bot) return;
  try {
    const cmds   = await getCommands();
    const tgCmds = cmds
      .filter(c => c.command && c.showInCommandList !== false)
      .map(c => ({ command: c.command.replace(/^\//, ''), description: c.label || c.command }));
    await bot.api.setMyCommands(tgCmds);
  } catch (err) { console.error('syncBotCommands:', err.message); }
}

// ✅ FIX: sendWorkerMessage properly resets inactivity timer and sends to Telegram
async function sendWorkerMessage(sessionId, content) {
  const db   = getDb();
  const snap = await db.collection('sessions').doc(sessionId).get();
  if (!snap.exists) throw new Error('Session not found');

  const s = snap.data();
  if (s.status !== 'active') throw new Error('Session is no longer active');

  const workerSnap = await db.collection('users').doc(s.workerId).get();
  const workerName = workerSnap.data()?.name || 'Agent';

  // Save message to Firestore (web dashboard will display it)
  await addMessage(sessionId, {
    from: 'worker', sessionId,
    senderName: workerName,
    type: 'text', content
  });

  // ✅ Reset agent-inactivity timer on every agent reply
  startAgentOnlyTimer(sessionId, s.customerTelegramId, s.workerTelegramId || null);

  // ✅ Send to customer on Telegram
  await bot.api.sendMessage(s.customerTelegramId, content);
}

async function closeSessionFromDashboard(sessionId) {
  const db   = getDb();
  const snap = await db.collection('sessions').doc(sessionId).get();
  if (!snap.exists) return;
  const s = { id: sessionId, ...snap.data() };
  await endSession(sessionId, s.customerTelegramId, s.workerTelegramId || null, 'manual');
}

async function sendOtpToTelegram(telegramChatId, otp, type = 'verify') {
  const msg = type === 'reset'
    ? `🔑 Password reset OTP: *${otp}*\n\nExpires in 10 minutes.`
    : `🔐 Verification OTP: *${otp}*\n\nSend these 6 digits here, or enter them in the dashboard.\n\nExpires in 10 minutes.`;
  await bot.api.sendMessage(telegramChatId, msg, { parse_mode: 'Markdown' });
}

function getBot() { return bot; }

module.exports = {
  startBot,
  sendWorkerMessage,
  closeSessionFromDashboard,
  sendOtpToTelegram,
  syncBotCommands,
  getBot
};
