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
const topicIds = {};

/* ===============================
   ID PARSER
   → faqat to‘g‘ri ID bo‘lsa qaytaradi
   → xato holatda null
================================ */
function parseValidId(text) {
  if (!text) return null;

  const match = text.match(/\b([KkКк])[-–—]?(\d{3,4})\b/);
  if (!match) return null;

  const letter = match[1];
  const digits = match[2];

  // faqat lotin K yoki k
  if (letter === 'K' || letter === 'k') {
    return 'K-' + digits;
  }

  // kirill bo‘lsa — qabul qilmaymiz, jim qolamiz
  return null;
}

/* ===============================
   XABAR LINKI
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return 'https://t.me/c/' + cleanChatId + '/' + messageId;
}

/* ===============================
   ASOSIY HANDLER
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    if (!topicIds[chatId]) topicIds[chatId] = {};
    if (!topicIds[chatId][topicId]) topicIds[chatId][topicId] = {};

    // 👉 faqat to‘g‘ri ID bo‘lsa ishlaymiz
    const canonicalId = parseValidId(msg.text);
    if (!canonicalId) return;

    // 👉 faqat TAKROR bo‘lsa javob beramiz
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
      // birinchi marta kelgan ID — jim
      topicIds[chatId][topicId][canonicalId] = msg.message_id;
    }

  } catch (err) {
    console.error('Xato:', err);
  }
});

/* ===============================
   ERROR HANDLER
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
