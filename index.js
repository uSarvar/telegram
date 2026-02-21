const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN) {
  console.error('BOT_TOKEN yo‘q');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true }
});

console.log('Bot ishga tushdi');

/* ======================= DB ======================= */

const DB_PATH = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/* ======================= MEMORY ======================= */

const messageCache = {};
const seenMessages = new Set();

/* ======================= UTILS ======================= */

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getMessageLink(chatId, messageId) {
  const clean = String(chatId).replace('-100', '');
  return `https://t.me/c/${clean}/${messageId}`;
}

/* ======================= PARSE ID ======================= */

function parseValidId(text) {
  if (!text) return null;

  const normalized = text
    .replace(/[Кк]/g, 'K')
    .replace(/[–—]/g, '-')
    .toUpperCase();

  const strict = normalized.replace(/\s+/g, '').match(/^K-?\d{3,4}$/);
  if (strict) {
    const digits = strict[0].match(/\d{3,4}/)[0];
    return `K-${digits}`;
  }

  const relaxed = normalized.match(/(?:^|\D)K-?(\d{3,4})(?!\d)/);
  if (!relaxed) return null;

  return `K-${relaxed[1]}`;
}

/* ======================= WORD DIFF ======================= */

function getWordLevelChanges(oldText, newText) {
  const oldW = oldText.split(/\s+/);
  const newW = newText.split(/\s+/);
  const max = Math.max(oldW.length, newW.length);
  const changes = [];

  for (let i = 0; i < max; i++) {
    const o = oldW[i];
    const n = newW[i];
    if (o === n) continue;

    if (o && n) changes.push(` <code>${escapeHtml(o)}</code> → <code>${escapeHtml(n)}</code>`);
    else if (o && !n) changes.push(`➖ <code>${escapeHtml(o)}</code>`);
    else if (!o && n) changes.push(`➕ <code>${escapeHtml(n)}</code>`);
  }
  return changes;
}

/* ======================= DUPLICATE (TOPIC-AWARE) ======================= */

function checkDuplicateId(id, chatId, topicId, msgId) {
  if (!id || !topicId) return;

  const db = loadDB();

  if (!db[chatId]) db[chatId] = {};
  if (!db[chatId][topicId]) db[chatId][topicId] = {};

  const topicMap = db[chatId][topicId];

  if (topicMap[id]) {
    const firstMsgId = topicMap[id];

    const firstLink = getMessageLink(chatId, firstMsgId);
    const secondLink = getMessageLink(chatId, msgId);

    const text =
      `🚨 <b>TAKROR ID ANIQLANDI</b>\n\n` +
      `ID: <b>${id}</b>\n\n` +
      `🔗 <a href="${firstLink}">1-yuborilgan ID</a>\n\n` +
      `🔗 <a href="${secondLink}">Takror yuborilgan ID</a>\n\n` +
      `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msgId,
      message_thread_id: topicId
    });

  } else {
    topicMap[id] = msgId;
    saveDB(db);
  }
}

/* ======================= MESSAGE ======================= */

bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;
    if (!msg.message_thread_id) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    const msgId = msg.message_id;

    const key = chatId + ':' + msgId;
    if (seenMessages.has(key)) return;
    seenMessages.add(key);

    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msgId] = msg.text;

    const id = parseValidId(msg.text);
    if (id) checkDuplicateId(id, chatId, topicId, msgId);

  } catch (e) {
    console.error('MSG error:', e);
  }
});

/* ======================= EDIT ======================= */

bot.on('edited_message', async (msg) => {
  try {
    if (!msg.text || !msg.message_thread_id) return;
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;

    const chatId = msg.chat.id;
    const msgId = msg.message_id;
    const topicId = msg.message_thread_id;

    if (!messageCache[chatId]) return;

    const oldText = messageCache[chatId][msgId];
    const newText = msg.text;

    if (!oldText || oldText === newText) return;

    const changes = getWordLevelChanges(oldText, newText);
    if (!changes.length) return;

    messageCache[chatId][msgId] = newText;

    const alert =
      `✏️ <b>Xabar matni o‘zgartirildi</b>\n\n` +
      changes.join('\n\n') +
      `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

    bot.sendMessage(chatId, alert, {
      parse_mode: 'HTML',
      reply_to_message_id: msgId,
      message_thread_id: topicId
    });

  } catch (e) {
    console.error('EDIT error:', e);
  }
});

/* ======================= CRASH ======================= */

process.on('uncaughtException', err => console.error('CRASH:', err));
process.on('unhandledRejection', err => console.error('REJECTION:', err));

/* ======================= HEARTBEAT ======================= */

setInterval(() => {
  console.log('Heartbeat → bot tirik');
}, 60000);
