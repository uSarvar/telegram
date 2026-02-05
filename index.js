const TelegramBot = require('node-telegram-bot-api');

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
   XOTIRA
================================ */

// Takror ID nazorati
const topicIds = {};

// Xabar matnlari cache (edit diff uchun)
const messageCache = {};

// Tahrirlar tarixi
const editHistory = {};

/* ===============================
   TO‘G‘RI ID PARSER
   → faqat butun xabar ID bo‘lsa qabul qiladi
================================ */
function parseValidId(text) {
  if (!text) return null;

  const match = text.trim().match(/^([Kk])[-–—]?(\d{3,4})$/);
  if (!match) return null;

  return 'K-' + match[2];
}

/* ===============================
   XABAR LINKI
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return 'https://t.me/c/' + cleanChatId + '/' + messageId;
}

/* ===============================
   MESSAGE HANDLER
   → faqat TAKROR ID da javob
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    // Cache (edit diff uchun)
    if (!messageCache[chatId]) messageCache[chatId] = {};
    messageCache[chatId][msg.message_id] = msg.text;

    // Topic xotira
    if (!topicIds[chatId]) topicIds[chatId] = {};
    if (!topicIds[chatId][topicId]) topicIds[chatId][topicId] = {};

    const canonicalId = parseValidId(msg.text);
    if (!canonicalId) return; // noto‘g‘ri ID → jim

    // TAKROR
    if (topicIds[chatId][topicId][canonicalId]) {
      const firstMessageId = topicIds[chatId][topicId][canonicalId];

      const alertMessage =
        '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
        'ID: <b>' + canonicalId + '</b>\n\n' +
        '🔗 <a href="' + getMessageLink(chatId, firstMessageId) + '">1-yuborilgan ID</a>\n' +
        '🔗 <a href="' + getMessageLink(chatId, msg.message_id) + '">Takror yuborilgan ID</a>\n\n' +
        '👨🏻‍💻 <a href="tg://user?id=' + ADMIN_ID + '"><b>Admin</b></a>';

      await bot.sendMessage(chatId, alertMessage, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      });
    } else {
      topicIds[chatId][topicId][canonicalId] = msg.message_id;
    }

  } catch (err) {
    console.error('Message handler error:', err);
  }
});

/* ===============================
   EDITED MESSAGE HANDLER
   → admin alert + diff + tarix
================================ */
bot.on('edited_message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    if (!messageCache[chatId]) messageCache[chatId] = {};

    const oldText = messageCache[chatId][msg.message_id] || '(old text unknown)';
    const newText = msg.text || '(no text)';

    // Cache update
    messageCache[chatId][msg.message_id] = newText;

    // Tarix saqlash
    if (!editHistory[chatId]) editHistory[chatId] = {};
    if (!editHistory[chatId][msg.message_id]) {
      editHistory[chatId][msg.message_id] = [];
    }

    editHistory[chatId][msg.message_id].push({
      oldText,
      newText,
      editedAt: new Date().toISOString()
    });

    // Console log
    console.log('EDITED MESSAGE:', {
      chatId,
      messageId: msg.message_id,
      oldText,
      newText
    });

    // Admin alert
    await bot.sendMessage(
      chatId,
      '✏️ <b>Xabar tahrirlandi</b>\n\n' +
      '👨🏻‍💻 <a href="tg://user?id=' + ADMIN_ID + '"><b>Admin</b></a>',
      {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      }
    );

  } catch (err) {
    console.error('Edited message error:', err);
  }
});

/* ===============================
   ERROR HANDLER
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
