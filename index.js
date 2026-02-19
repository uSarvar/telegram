// ===============================
// PRO STABLE TELEGRAM BOT
// ===============================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===============================
// ENV
// ===============================
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  console.error('ENV xato: BOT_TOKEN yoki ADMIN_ID yo‘q');
  process.exit(1);
}

// ===============================
// GLOBAL SAFE HANDLERS
// ===============================
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('REJECTION:', err);
});

// ===============================
// BOT INIT (Conflict Auto-Fix)
// ===============================
let bot;

function startBot() {
  bot = new TelegramBot(TOKEN, {
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 }
    }
  });

  console.log('Bot ishga tushdi');

  // Conflict auto-fix
  bot.on('polling_error', async (err) => {
    if (String(err).includes('409')) {
      console.log('Conflict aniqladi → polling restart...');
      setTimeout(() => startBot(), 3000);
    } else {
      console.error('Polling error:', err.message);
    }
  });

  registerHandlers();
}

startBot();

// ===============================
// DB SAFE SYSTEM (Anti Corruption)
// ===============================
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const DB_BACKUP = path.join(__dirname, 'data', 'db.backup.json');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    console.error('DB buzildi → backup tiklandi');
    if (fs.existsSync(DB_BACKUP)) {
      return JSON.parse(fs.readFileSync(DB_BACKUP, 'utf8'));
    }
    return {};
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_BACKUP, JSON.stringify(db, null, 2));
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error('DB save xato:', e);
  }
}

// ===============================
// MEMORY SYSTEM
// ===============================
const messageCache = {};
const recentHashes = new Set(); // double-message block
const userFlood = {}; // spam guard

// ===============================
// HELPERS
// ===============================

// Normalize ID (K/k/К/к → K-XXXX)
function parseValidId(text) {
  if (!text) return null;

  const cleaned = text.replace(/\s+/g, '').toUpperCase();
  const m = cleaned.match(/^([KК])[-–—]?(\d{3,4})$/);
  if (!m) return null;

  return `K-${m[2]}`;
}

function getMessageLink(chatId, messageId) {
  const id = String(chatId).replace('-100', '');
  return `https://t.me/c/${id}/${messageId}`;
}

function hashMessage(msg) {
  return crypto
    .createHash('md5')
    .update(msg.chat.id + '_' + msg.message_id + '_' + (msg.text || ''))
    .digest('hex');
}

// ===============================
// SPAM / FLOOD GUARD
// ===============================
function isFlood(userId) {
  const now = Date.now();
  if (!userFlood[userId]) userFlood[userId] = [];

  userFlood[userId] = userFlood[userId].filter(t => now - t < 5000);
  userFlood[userId].push(now);

  return userFlood[userId].length > 6; // 5 sec ichida 6+ msg → flood
}

// ===============================
// MAIN HANDLERS
// ===============================
function registerHandlers() {

  // ===============================
  // MESSAGE HANDLER
  // ===============================
  bot.on('message', async (msg) => {
    try {
      if (!['group', 'supergroup'].includes(msg.chat.type)) return;
      if (!msg.text) return;

      // Flood guard
      if (isFlood(msg.from.id)) return;

      // Double-message block
      const h = hashMessage(msg);
      if (recentHashes.has(h)) return;
      recentHashes.add(h);
      setTimeout(() => recentHashes.delete(h), 10000);

      const chatId = msg.chat.id;
      const topicId = msg.message_thread_id;
      if (!topicId) return;

      // cache
      if (!messageCache[chatId]) messageCache[chatId] = {};
      messageCache[chatId][msg.message_id] = msg.text;

      const id = parseValidId(msg.text);
      if (!id) return;

      const db = loadDB();
      db[chatId] ??= {};
      db[chatId][topicId] ??= {};

      if (db[chatId][topicId][id]) {
        const firstMsg = db[chatId][topicId][id];

        const text =
          `🚨 <b>TAKROR ID ANIQLANDI</b>\n\n` +
          `<b>${id}</b>\n\n` +
          `🔗 <a href="${getMessageLink(chatId, firstMsg)}">1-yuborilgan ID</a>\n\n` +
          `🔗 <a href="${getMessageLink(chatId, msg.message_id)}">Takror yuborilgan ID</a>\n\n` +
          `👮 <a href="tg://user?id=${ADMIN_ID}">Admin</a>`;

        await bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        });

      } else {
        db[chatId][topicId][id] = msg.message_id;
        saveDB(db);
      }

    } catch (e) {
      console.error('MSG error:', e);
    }
  });

  // ===============================
  // EDIT HANDLER
  // ===============================
  bot.on('edited_message', async (msg) => {
    try {
      if (!msg.text) return;
      if (!['group', 'supergroup'].includes(msg.chat.type)) return;

      const chatId = msg.chat.id;
      const topicId = msg.message_thread_id;
      if (!topicId) return;

      const oldText = messageCache?.[chatId]?.[msg.message_id];
      const newText = msg.text;

      if (!oldText || oldText === newText) return;

      messageCache[chatId][msg.message_id] = newText;

      const text =
        `✏️ <b>Xabar tahrirlandi</b>\n\n` +
        `<code>${oldText}</code>\n⬇️\n<code>${newText}</code>\n\n` +
        `👮 <a href="tg://user?id=${ADMIN_ID}">Admin</a>`;

      await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      });

    } catch (e) {
      console.error('EDIT error:', e);
    }
  });
}

// ===============================
// KEEP ALIVE (Sleep Protection)
// ===============================
setInterval(() => {
  console.log('Heartbeat → bot tirik');
}, 60000);
