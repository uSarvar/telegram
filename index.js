const TelegramBot = require('node-telegram-bot-api');
/* ===============================
   ENV O'ZGARUVCHILAR
================================ */
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  console.error('❌ BOT_TOKEN yoki ADMIN_ID yo‘q');
  process.exit(1);
}
console.log('✅ ENV tayyor');
/* ===============================
   BOT INIT (POLLING)
================================ */
const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true
  }
});
console.log('🤖 Bot ishga tushdi');
/* ===============================
   XOTIRA STRUKTURASI
   topicNumbers[chatId][topicId][number] = firstMessageId
================================ */
const topicNumbers = {};
/* ===============================
   YORDAMCHI FUNKSIYALAR
================================ */
function extractFourDigitNumbers(text) {
  const regex = /\b\d{4}\b/g;
  return text ? text.match(regex) || [] : [];
}
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return `https://t.me/c/${cleanChatId}/${messageId}`;
}
/* ===============================
   ASOSIY HANDLER
================================ */
bot.on('message', async (msg) => {
  try {
    // Faqat guruhlar
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;

    // Faqat topic ichida ishlaydi
    if (!topicId) return;

    // Xotira tayyorlash
    if (!topicNumbers[chatId]) topicNumbers[chatId] = {};
    if (!topicNumbers[chatId][topicId]) topicNumbers[chatId][topicId] = {};

    const numbers = extractFourDigitNumbers(msg.text);
    if (!numbers.length) return;

    for (const num of numbers) {
      // AGAR TAKROR BO‘LSA
      if (topicNumbers[chatId][topicId][num]) {
        const firstMessageId = topicNumbers[chatId][topicId][num];
        const firstMessageLink = getMessageLink(chatId, firstMessageId);
        const repeatMessageLink = getMessageLink(chatId, msg.message_id);

        const alertMessage =
          `🚨 <b>TAKROR ANIQLANDI</b>\n\n` +

          `<b>ID</b> + `<b><code>${num}</code></b>\n\n` +

          `🔗 <a href="${firstMessageLink}">1-yuborilgan xabar</a>\n\n` +

          `🔗 <a href="${repeatMessageLink}">Takror yuborilgan xabar</a>\n\n` +

          `👮 <b>Nazorat:</b> + `<a href="tg://user?id=${ADMIN_ID}">Admin</a>`;

        await bot.sendMessage(chatId, alertMessage, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        });

      } else {
        // BIRINCHI MARTA KELGAN RAQAM
        topicNumbers[chatId][topicId][num] = msg.message_id;
        console.log(`✅ Saqlandi: ${num} (topic ${topicId})`);
      }
    }

  } catch (err) {
    console.error('❌ Xato:', err);
  }
});
/* ===============================
   ERROR HANDLERLAR
================================ */
bot.on('polling_error', (err) => {
  console.error('❌ Polling error:', err.message);
});
bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});
console.log('🚀 Bot xabarlarni kuzatmoqda...');
