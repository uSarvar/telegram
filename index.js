const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN) {
  console.error('BOT_TOKEN yo‘q');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

/* ======================= MEMORY ======================= */

const messageCache = {};
const seenMessages = new Set();
const seenIds = new Map();

/* ======================= UTILS ======================= */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ======================= PARSE ID ======================= */
/* K-1234, k1234, К1234, 1.k-1234 → K-1234 */

function parseValidId(text) {
  if (!text) return null;

  const cleaned = text.replace(/\s+/g, '').toUpperCase();

  const m = cleaned.match(/(?:^|[^A-Z0-9])([KК])[-–—]?(\d{3,4})(?!\d)/);
  if (!m) return null;

  return `K-${m[2]}`;
}

/* ======================= WORD DIFF ======================= */

function getWordLevelChanges(oldText, newText) {
  if (!oldText || !newText) return [];

  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);
  const changes = [];

  const maxLen = Math.max(oldWords.length, newWords.length);

  for (let i = 0; i < maxLen; i++) {
    const o = oldWords[i];
    const n = newWords[i];

    if (o === n) continue;

    if (o && n) {
      changes.push(`🔁 <code>${escapeHtml(o)}</code> → <code>${escapeHtml(n)}</code>`);
      continue;
    }

    if (o && !n) {
      changes.push(`➖ O‘chirildi: <code>${escapeHtml(o)}</code>`);
      continue;
    }

    if (!o && n) {
      changes.push(`➕ Qo‘shildi: <code>${escapeHtml(n)}</code>`);
    }
  }

  return changes;
}

/* ======================= DUPLICATE ID ======================= */

function checkDuplicateId(id, chatId, msgId) {
  if (!id) return;

  if (!seenIds.has(chatId)) seenIds.set(chatId, new Map());

  const map = seenIds.get(chatId);

  if (map.has(id)) {
    const firstMsgId = map.get(id);

    const text =
      `🚨 <b>TAKROR ID ANIQLANDI</b>\n\n` +
      `<code>${id}</code>\n\n` +
      `🔗 1-yuborilgan ID\n\n` +
      `🔗 Takror yuborilgan ID`;

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });
  } else {
    map.set(id, msgId);
  }
}

/* ======================= MESSAGE HANDLER ======================= */

bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const msgId = msg.message_id;

    /* double message block */
    const key = chatId + ':' + msgId;
    if (seenMessages.has(key)) return;
    seenMessages.add(key);

    /* cache save */
    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msgId] = msg.text;

    /* duplicate ID */
    const id = parseValidId(msg.text);
    if (id) checkDuplicateId(id, chatId, msgId);

  } catch (e) {
    console.error('Message error:', e);
  }
});

/* ======================= EDIT HANDLER ======================= */

bot.on('edited_message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const msgId = msg.message_id;

    if (!messageCache[chatId]) messageCache[chatId] = {};

    const oldText = messageCache[chatId][msgId];
    const newText = msg.text;

    if (!oldText || oldText === newText) return;

    const changes = getWordLevelChanges(oldText, newText);
    if (!changes.length) return;

    messageCache[chatId][msgId] = newText;

    const alert =
      `✏️ <b>Xabar matni o‘zgartirildi</b>\n\n` +
      `<b>O‘zgargan qismlar:</b>\n\n` +
      changes.join('\n') + `\n\n
      👨🏻‍💻 <a href="tg://user?id=${ADMIN_ID}"><b>Admin</b></a>`;

    await bot.sendMessage(chatId, alert, {
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });

  } catch (e) {
    console.error('Edit error:', e);
  }
});

/* ======================= CRASH PROTECTION ======================= */

process.on('uncaughtException', (err) => {
  console.error('CRASH:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('REJECTION:', err);
});

/* ======================= HEARTBEAT (Railway Sleep Fix) ======================= */

setInterval(() => {
  console.log('Heartbeat → bot tirik');
}, 60000);

/* ======================= START ======================= */

console.log('Bot ishga tushdi');
