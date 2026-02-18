const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

/* ===============================
   ENV
================================ */
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  console.error('BOT_TOKEN yoki ADMIN_ID topilmadi');
  process.exit(1);
}

/* ===============================
   BOT INIT
================================ */
const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true }
});

console.log('Bot ishga tushdi');

/* ===============================
   DB INIT (JSON)
================================ */
const DB_PATH = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/* ===============================
   CACHE (original texts)
================================ */
const messageCache = {};

/* ===============================
   UNIVERSAL ID PARSER
   K/k/К/к → K-XXXX
================================ */
function extractIDs(text) {
  if (!text) return [];

  const regex = /(?:^|\s|\n|\.|,|\)|\()([KkКк])\s*[-–—]?\s*(\d{3,6})/g;

  const ids = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    ids.push(`K-${match[2]}`);
  }

  return ids;
}

/* ===============================
   MESSAGE LINK
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return `https://t.me/c/${cleanChatId}/${messageId}`;
}

/* ===============================
   WORD DIFF
================================ */
function getWordLevelChanges(oldText, newText) {
  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);

  const maxLen = Math.max(oldWords.length, newWords.length);
  const changes = [];

  for (let i = 0; i < maxLen; i++) {
    const o = oldWords[i];
    const n = newWords[i];

    if (o === n) continue;

    if (o && !n) {
      changes.push(`➖ <code>${o}</code>`);
    } else if (!o && n) {
      changes.push(`➕ <code>${n}</code>`);
    } else if (o && n && o !== n) {
      changes.push(`<code>${o}</code> → <code>${n}</code>`);
    }
  }

  return changes;
}

/* ===============================
   MESSAGE HANDLER
   → ONLY DUPLICATE ID ALERT
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    // cache text
    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msg.message_id] = msg.text;

    const ids = extractIDs(msg.text);
    if (!ids.length) return;

    const db = loadDB();
    if (!db[chatId]) db[chatId] = {};
    if (!db[chatId][topicId]) db[chatId][topicId] = {};

    for (const canonicalId of ids) {

      if (db[chatId][topicId][canonicalId]) {

        const firstMessageId = db[chatId][topicId][canonicalId];

        const alertMessage =
          '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
          `<b>ID:</b> <code>${canonicalId}</code>\n\n` +
          `🔗 <a href="${getMessageLink(chatId, firstMessageId)}">1-yuborilgan ID</a>\n\n` +
          `🔗 <a href="${getMessageLink(chatId, msg.message_id)}">Takror yuborilgan ID</a>\n\n` +
          `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

        await bot.sendMessage(chatId, alertMessage, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        });

      } else {
        db[chatId][topicId][canonicalId] = msg.message_id;
      }
    }

    saveDB(db);

  } catch (err) {
    console.error('Message error:', err);
  }
});

/* ===============================
   EDITED MESSAGE HANDLER
   → WORD LEVEL DIFF
================================ */
bot.on('edited_message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    if (!messageCache[chatId]) messageCache[chatId] = {};

    const oldText = messageCache[chatId][msg.message_id];
    const newText = msg.text;

    if (!oldText || oldText === newText) return;

    const changes = getWordLevelChanges(oldText, newText);
    if (!changes.length) return;

    // update cache
    messageCache[chatId][msg.message_id] = newText;

    const alertMessage =
      '✏️ <b>Xabar matni o‘zgartirildi</b>\n\n' +
      '<b>O‘zgargan qismlar:</b>\n' +
      changes.join('\n') +
      '\n\n' +
      `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

    await bot.sendMessage(chatId, alertMessage, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
      message_thread_id: topicId
    });

  } catch (err) {
    console.error('Edit error:', err);
  }
});

/* ===============================
   ERROR HANDLER
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
