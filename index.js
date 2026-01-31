const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi! Railway Variables ni tekshiring.');
  process.exit(1);
}

if (!ADMIN_ID) {
  console.error('❌ ADMIN_ID topilmadi!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const topicNumbers = {};

function extractFourDigitNumbers(text) {
  const regex = /\b\d{4}\b/g;
  return text.match(regex) || [];
}

bot.on('message', async (msg) => {
  if (!['group', 'supergroup'].includes(msg.chat.type)) return;

  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id || 0;
  const text = msg.text || '';

  if (!topicNumbers[chatId]) topicNumbers[chatId] = {};
  if (!topicNumbers[chatId][topicId]) {
    topicNumbers[chatId][topicId] = new Set();
  }

  const numbers = extractFourDigitNumbers(text);
  if (!numbers.length) return;

  for (const num of numbers) {
    if (topicNumbers[chatId][topicId].has(num)) {
      await bot.sendMessage(
        chatId,
        `⚠️ <b>DIQQAT!</b>\n\n` +
        `🔁 <b>${num}</b> ID takrorlandi!\n` +
        `👤 <a href="tg://user?id=${ADMIN_ID}">Admin</a>`,
        {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        }
      );
    } else {
      topicNumbers[chatId][topicId].add(num);
    }
  }
});

console.log('🤖 Bot ishga tushdi');
