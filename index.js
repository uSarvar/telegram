const TelegramBot = require('node-telegram-bot-api');

/* ===============================
   ENV TEKSHIRUV
================================ */
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi!');
  process.exit(1);
}

if (!ADMIN_ID) {
  console.error('❌ ADMIN_ID topilmadi!');
  process.exit(1);
}

console.log('✅ ENV tekshirildi. Token BOR, Admin BOR');
/* =============================== BOT INIT (POLLING) ================================ */
const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true
  }
});

console.log('🤖 Bot polling bilan ishga tushdi');
/* =============================== DEBUG / ERROR HANDLERS ================================ */
bot.on('polling_error', (err) => {
  console.error('❌ Polling error:', err.message);
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});
/* =============================== XABAR KELAYOTGANINI ANIQLASH ================================ */
bot.on('message', (msg) => {
  console.log('📩 MESSAGE KELDI:', {
    chatType: msg.chat.type,
    chatId: msg.chat.id,
    topicId: msg.message_thread_id,
    text: msg.text
  });
});
/* =============================== 4 XONALI RAQAM LOGIKASI ================================ */
const topicNumbers = {};

function extractFourDigitNumbers(text) {
  const regex = /\b\d{4}\b/g;
  return text ? text.match(regex) || [] : [];
}
/* =============================== ASOSIY ISHCHI HANDLER ================================ */
bot.on('message', async (msg) => {
  try {
    // faqat guruhlar
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;

    // faqat topic ichida ishlasin
    if (!topicId) {
      console.log('ℹ️ Topic emas, o‘tkazib yuborildi');
      return;
    }

    if (!topicNumbers[chatId]) topicNumbers[chatId] = {};
    if (!topicNumbers[chatId][topicId]) {
      topicNumbers[chatId][topicId] = new Set();
    }

    const numbers = extractFourDigitNumbers(msg.text);
    if (!numbers.length) return;

    for (const num of numbers) {
      if (topicNumbers[chatId][topicId].has(num)) {
        console.log(`⚠️ Takror topildi: ${num}`);

        await bot.sendMessage(
          chatId,
          `⚠️ <b>TAKROR ID ANIQLANDI</b>\n\n` +
          `🔢 ID: <code>${num}</code>\n` +
          `👮 <a href="tg://user?id=${ADMIN_ID}">Admin</a>`,
          {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id,
            message_thread_id: topicId
          }
        );
      } else {
        topicNumbers[chatId][topicId].add(num);
        console.log(`✅ Yangi raqam saqlandi: ${num}`);
      }
    }
  } catch (err) {
    console.error('❌ Handler error:', err);
  }
});
/* =============================== START LOG ================================ */
console.log('🚀 Bot to‘liq tayyor va xabar kutyapti...');
