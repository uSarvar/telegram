const TelegramBot = require('node-telegram-bot-api');

/* ENV */
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  console.error('BOT_TOKEN yoki ADMIN_ID topilmadi');
  process.exit(1);
}

/* BOT */
const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true }
});

/* XOTIRA */
const topicNumbers = {};

/* FUNKSIYALAR */
function extractFourDigitNumbers(text) {
  const regex = /\b\d{4}\b/g;
  return text ? text.match(regex) || [] : [];
}

function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return 'https://t.me/c/' + cleanChatId + '/' + messageId;
}

/* HANDLER */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    if (!topicNumbers[chatId]) topicNumbers[chatId] = {};
    if (!topicNumbers[chatId][topicId]) topicNumbers[chatId][topicId] = {};

    const numbers = extractFourDigitNumbers(msg.text);
    if (!numbers.length) return;

    for (const num of numbers) {
      if (topicNumbers[chatId][topicId][num]) {
        const firstId = topicNumbers[chatId][topicId][num];

        // const alertMessage =
        //   '🚨 <b>TAKROR ANIQLANDI</b>\n\n' +
        //   '🔢 <b>RAQAM</b>\n\n' +
        //   '>>>  <b><code>' + num + '</code></b>  <<<\n\n' +
        //   '📌 <b>1-yuborilgan xabar:</b>\n' +
        //   '🔗 <a href="' + getMessageLink(chatId, firstId) + '">Oldingi xabarni ochish</a>\n\n' +
        //   '📌 <b>Takror yuborilgan xabar:</b>\n' +
        //   '🔗 <a href="' + getMessageLink(chatId, msg.message_id) + '">Takror xabarni ochish</a>\n\n' +
        //   '👮 <b>Nazorat:</b>\n' +
        //   '<a href="tg://user?id=' + ADMIN_ID + '">Admin</a>';

         const alertMessage =
           '🚨 <b>TAKROR ANIQLANDI</b>\n\n' +
           '🔢 ▶▶  <b><code>' + num + '</code></b>  ◀◀\n\n' +
           '📌 <a href="' + getMessageLink(chatId, firstId) + '"><b>1-yuborilgan xabar</b></a>\n\n' +
           '📌 <a href="' + getMessageLink(chatId, msg.message_id) + '"><b>Takror yuborilgan xabar</b></a>\n\n' +
           '👮 <a href="tg://user?id=' + ADMIN_ID + '"><b>Admin</b></a>';

        await bot.sendMessage(chatId, alertMessage, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        });
      } else {
        topicNumbers[chatId][topicId][num] = msg.message_id;
      }
    }
  } catch (err) {
    console.error('Xato:', err);
  }
});

/* ERROR */
bot.on('polling_error', (e) => console.error('Polling error:', e.message));

console.log('Bot ishga tushdi');

