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
   DB INIT
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
   CACHE (edit uchun)
================================ */
const messageCache = {};
const editHistory = {};

/* ===============================
   ID PARSER
   K/k/К/к → K-XXXX
================================ */
function parseValidId(text) {
  if (!text) return null;

  const cleaned = text.trim().replace(/\s+/g, '');
  const match = cleaned.match(/^([KkКк])[-–—]?(\d{3,4})$/);
  if (!match) return null;

  return 'K-' + match[2];
}

/* ===============================
   LINK
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return `https://t.me/c/${cleanChatId}/${messageId}`;
}

/* ===============================
   MESSAGE HANDLER
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    // cache
    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msg.message_id] = msg.text;

    const canonicalId = parseValidId(msg.text);
    if (!canonicalId) return;

    const db = loadDB();
    if (!db[chatId]) db[chatId] = {};
    if (!db[chatId][topicId]) db[chatId][topicId] = {};

    if (db[chatId][topicId][canonicalId]) {
      const firstMessageId = db[chatId][topicId][canonicalId];

      const alertMessage =
        '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
        `ID: <b>${canonicalId}</b>\n\n` +
        `🔗 <a href="${getMessageLink(chatId, firstMessageId)}">1-yuborilgan xabar</a>\n\n` +
        `🔗 <a href="${getMessageLink(chatId, msg.message_id)}">Takror yuborilgan xabar</a>\n\n` +
        `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

      await bot.sendMessage(chatId, alertMessage, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      });

    } else {
      db[chatId][topicId][canonicalId] = msg.message_id;
      saveDB(db);
    }

  } catch (err) {
    console.error('Message error:', err);
  }
});

/* ===============================
   EDITED MESSAGE HANDLER
   → faqat MATN o‘zgarsa
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
    if (!oldText || oldText === msg.text) return; // matn o‘zgarmagan

    const newText = msg.text;
    messageCache[chatId][msg.message_id] = newText;

    if (!editHistory[chatId]) editHistory[chatId] = {};
    if (!editHistory[chatId][msg.message_id]) {
      editHistory[chatId][msg.message_id] = [];
    }

    editHistory[chatId][msg.message_id].push({
      oldText,
      newText,
      editedAt: new Date().toISOString()
    });

    console.log('EDITED TEXT:', { oldText, newText });

    await bot.sendMessage(
      chatId,
      '✏️ <b>Xabar matni o‘zgartirildi</b>\n\n' +
      `👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`,
      {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      }
    );

  } catch (err) {
    console.error('Edit error:', err);
  }
});

/* ===============================
   ERROR
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
