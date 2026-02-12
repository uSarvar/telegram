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
   CACHE & HISTORY
================================ */
const messageCache = {};   // original texts
const editHistory = {};    // edit logs (RAM)

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
   MESSAGE LINK
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return `https://t.me/c/${cleanChatId}/${messageId}`;
}

/* ===============================
   TEXT DIFF (ONLY CHANGED PART)
================================ */
function getTextDiff(oldText, newText) {
  let start = 0;
  let endOld = oldText.length - 1;
  let endNew = newText.length - 1;

  while (
    start <= endOld &&
    start <= endNew &&
    oldText[start] === newText[start]
  ) {
    start++;
  }

  while (
    endOld >= start &&
    endNew >= start &&
    oldText[endOld] === newText[endNew]
  ) {
    endOld--;
    endNew--;
  }

  const oldDiff = oldText.substring(start, endOld + 1) || '(o‘chirildi)';
  const newDiff = newText.substring(start, endNew + 1) || '(qo‘shildi)';

  return { oldDiff, newDiff };
}

/* ===============================
   MESSAGE HANDLER
   → only DUPLICATE ID triggers reply
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    // cache original text
    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msg.message_id] = msg.text;

    const canonicalId = parseValidId(msg.text);
    if (!canonicalId) return;

    const db = loadDB();
    if (!db[chatId]) db[chatId] = {};
    if (!db[chatId][topicId]) db[chatId][topicId] = {};

    // DUPLICATE CHECK
    if (db[chatId][topicId][canonicalId]) {
      const firstMessageId = db[chatId][topicId][canonicalId];

      const alertMessage =
        '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
        `ID: <b>${canonicalId}</b>\n\n` +
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
      saveDB(db);
    }

  } catch (err) {
    console.error('Message error:', err);
  }
});

/* ===============================
   EDITED MESSAGE HANDLER
   → every text edit
   → shows ONLY changed part
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

    // cache update
    messageCache[chatId][msg.message_id] = newText;

    console.log('WORD-LEVEL CHANGES:', changes);

    const alertMessage =
      '✏️ <b>Xabar matni o‘zgartirildi</b>\n\n' +
      '<b>O‘zgargan qismlar:</b>\n' +
      changes.join('\n') + '\n\n' +
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
