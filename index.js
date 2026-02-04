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
   ID PARSER (3–4 xonali)
================================ */
function parseId(text) {
  if (!text) return null;

  // harf + optional "-" + raqamlar
  const match = text.match(/\b([A-Za-zА-Яа-я])[-–—]?(\d+)\b/);

  // faqat raqam bo‘lsa
  if (!match) {
    if (/\b\d+\b/.test(text)) {
      return { error: 'FORMAT' };
    }
    return null;
  }

  const letter = match[1];
  const digits = match[2];

  // Raqam uzunligi: FAQAT 3 yoki 4
  if (digits.length < 3 || digits.length > 4) {
    return { error: 'LENGTH' };
  }

  // Lotin K
  if (letter === 'K' || letter === 'k') {
    return {
      id: 'K-' + digits,
      warning: null
    };
  }

  // Kirill K
  if (letter === 'К' || letter === 'к') {
    return {
      id: 'K-' + digits,
      warning: 'CYRILLIC'
    };
  }

  // Boshqa harf
  return { error: 'LETTER' };
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

    const result = parseId(msg.text);
    if (!result) return;

    /* ===== XATO HOLATLAR ===== */
    if (result.error) {
      let text = '';

      if (result.error === 'FORMAT') {
        text = '❗️ <b>ID xato kiritildi</b>\n\nID <b>K-123</b> yoki <b>K-1234</b> formatida yozilishi kerak.';
      } else if (result.error === 'LENGTH') {
        text = '❗️ <b>ID xato</b>\n\nID faqat <b>3 yoki 4 xonali</b> bo‘lishi kerak.';
      } else if (result.error === 'LETTER') {
        text = '❗️ <b>ID xato</b>\n\nID faqat lotin <b>K-123</b> yoki <b>K-1234</b> formatida yozilishi kerak.';
      }

      await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        message_thread_id: topicId
      });
      return;
    }

    const canonicalId = result.id;

    /* ===== KIRILL OGOHLANTIRISH ===== */
    if (result.warning === 'CYRILLIC') {
      await bot.sendMessage(
        chatId,
        '⚠️ <b>Ogohlantirish</b>\n\nID kirill harfida yozilgan.\nIltimos, lotin <b>K-123</b> yoki <b>K-1234</b> formatidan foydalaning.',
        {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        }
      );
    }

    /* ===== TAKROR TEKSHIRUV ===== */
    if (topicIds[chatId][topicId][canonicalId]) {
      const firstMessageId = topicIds[chatId][topicId][canonicalId];

      const alertMessage =
        '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
        'ID: <b>' + canonicalId + '</b>\n\n' +
        '🔗 <a href="' + getMessageLink(chatId, firstMessageId) + '">1-yuborilgan ID</a>\n\n' +
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
    console.error('Xato:', err);
  }
});

/* ===============================
   ERROR HANDLER
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
